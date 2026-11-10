#!/usr/bin/env python3
"""Task-record writer: templates.task_record + host fields -> a record the routing verifier accepts.

Usage:
  record.py put <task_id> [fields.json|-] [--jev out.json]   merge fields (and jev.py's record_fields), validate, write
  record.py set-pane <task_id> <order_id> <pane_id>
  record.py check [task_id ...]                               validate existing records (all when none named)
  record.py --self-test
Exit: 0 written/valid, 1 invalid (nothing written), 2 usage, missing record or order, or jsonschema missing."""
import contextlib, copy, importlib.util, io, json, os, re, shutil, sys, tempfile
from pathlib import Path

from paths import ROUTING

TASKS = ROUTING / 'tasks'  # self-tests point this at a temp folder


def templates():
    return json.loads((ROUTING / 'jev_task_routing.json').read_text(encoding='utf-8'))['templates']


def path_of(task_id):
    if not re.fullmatch(r'[\w-][\w.-]*', task_id):
        print(f'bad task id {task_id!r}')
        raise SystemExit(2)
    return TASKS / f'{task_id}.json'


def merge(base, new):
    """Objects merge, lists and scalars replace."""
    for k, v in new.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            merge(base[k], v)
        else:
            base[k] = copy.deepcopy(v)
    return base


def validate(rec, task_id):
    """Run the verifier's own task-record check on the candidate alone. Returns (ok, lines)."""
    spec = importlib.util.spec_from_file_location('verify_routing', ROUTING / 'verify_routing.py')
    vr = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(vr)
    schema = json.loads((ROUTING / 'jev_task_routing.schema.json').read_text(encoding='utf-8'))
    rep, out = vr.Report(quiet=True), io.StringIO()
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / 'tasks').mkdir()
        (Path(tmp) / 'tasks' / f'{task_id}.json').write_text(json.dumps(rec), encoding='utf-8')
        with contextlib.redirect_stdout(out):
            vr.check_task_records(Path(tmp), rep, schema)
    return rep.fail == 0, out.getvalue().rstrip().splitlines()


def write(rec, task_id):
    p = path_of(task_id)
    ok, lines = validate(rec, task_id)
    if not ok:
        return 1, [f'INVALID {task_id}'] + lines
    if p.exists():
        shutil.copy2(p, p.with_name(p.name + '.bak'))  # records are not in git: the .bak is the only undo
    tmp = p.with_name(p.name + '.tmp')
    tmp.write_text(json.dumps(rec, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    os.replace(tmp, p)
    return 0, [f'WROTE {p}']


def load(task_id):
    p = path_of(task_id)
    return json.loads(p.read_text(encoding='utf-8')) if p.exists() else None


def put(task_id, fields=None, jev=None):
    t = templates()
    rec = load(task_id) or dict(copy.deepcopy(t['task_record']), task_id=task_id)
    for new in (jev or {}, fields or {}):
        items = new.get('role_work_items')
        if isinstance(items, dict) and isinstance(rec.get('role_work_items'), dict):
            for oid in items:
                rec['role_work_items'].setdefault(oid, dict(copy.deepcopy(t['work_order']), task_id=task_id, order_id=oid))
        merge(rec, new)
    return write(rec, task_id)


def set_pane(task_id, order_id, pane_id):
    rec = load(task_id)
    if rec is None:
        return 2, [f'missing record {task_id}']
    if order_id not in (rec.get('role_work_items') or {}):
        return 2, [f'missing order {order_id} in {task_id}']
    rec['role_work_items'][order_id]['pane_id'] = pane_id
    return write(rec, task_id)


def check(ids=()):
    ids = list(ids) or sorted(p.name[:-5] for p in TASKS.glob('*.json'))
    code, lines = 0, []
    for i in ids:
        rec = load(i)
        if rec is None:
            code, lines = 2, lines + [f'missing record {i}']
            continue
        ok, out = validate(rec, i)
        if not ok:
            code, lines = max(code, 1), lines + [f'INVALID {i}'] + out
    return code, lines + ([f'check ok ({len(ids)} record(s))'] if code == 0 else [])


def read_json(arg):
    return json.load(sys.stdin) if arg == '-' else json.loads(Path(arg).read_text(encoding='utf-8'))


def main(argv):
    try:
        import jsonschema  # noqa: F401  the verifier silently skips schema checks without it
    except ImportError:
        print('jsonschema is not installed (pip install jsonschema)')
        return 2
    if argv[:1] == ['put'] and len(argv) >= 2:
        args, jev = argv[2:], None
        if '--jev' in args:
            i = args.index('--jev')
            jev = read_json(args[i + 1])['record_fields']
            args = args[:i] + args[i + 2:]
        code, lines = put(argv[1], read_json(args[0]) if args else None, jev)
    elif argv[:1] == ['set-pane'] and len(argv) == 4:
        code, lines = set_pane(*argv[1:])
    elif argv[:1] == ['check']:
        code, lines = check(argv[1:])
    else:
        print(__doc__)
        return 2
    print('\n'.join(lines))
    return code


def self_test():
    global TASKS
    with tempfile.TemporaryDirectory() as tmp:
        TASKS = Path(tmp)
        t = templates()
        assert put('t1') == (0, [f'WROTE {TASKS / "t1.json"}'])
        assert load('t1') == dict(t['task_record'], task_id='t1') and check(['t1'])[0] == 0
        for bad in ({'repair_cycles': 'x'}, {'surprise': 1}, {'role_work_items': {'o1': {'launch_channel': 'subagent'}}},
                    {'evidence_orders_evaluated': {'researcher_triggers': ['RES-1']}}):
            code, lines = put('t2', bad)
            assert code == 1 and lines[0] == 'INVALID t2' and not (TASKS / 't2.json').exists(), (bad, lines)
        assert put('t1', {'role_work_items': {'o1': {'role_id': 'planner'}}})[0] == 0
        order = load('t1')['role_work_items']['o1']
        assert len(order) == len(t['work_order']) == 25 and (order['task_id'], order['order_id'], order['role_id']) == ('t1', 'o1', 'planner')
        assert put('t1', {'workflow_id': 'standard'})[0] == 0
        assert load('t1')['role_work_items']['o1']['role_id'] == 'planner' and load('t1')['workflow_id'] == 'standard'
        assert (TASKS / 't1.json.bak').exists()
        assert set_pane('t1', 'o9', 'w1:p1')[0] == 2 and set_pane('t9', 'o1', 'w1:p1')[0] == 2
        assert set_pane('t1', 'o1', 'w1:p1')[0] == 0 and load('t1')['role_work_items']['o1']['pane_id'] == 'w1:p1'
        before = (TASKS / 't1.json').read_bytes()
        assert put('t1', {'repair_cycles': -1})[0] == 1 and (TASKS / 't1.json').read_bytes() == before
        import jev  # a jev.py result merges into a valid record
        ans = {k: {'type': 'noul', 'noul': 0.0} for k in jev.questions(jev.load()[0])}
        ans['testing_mode'] = {'type': 'choice', 'choice': 'needs_context', 'probabilities': {'needs_context': 1.0}, 'confidence': 0.9}
        out = {'request_model': 'm', 'response_model': 'm', 'answers': ans, 'status': 'NEEDS_CONTEXT', 'risk': 'high',
               'provisional_risk': True, 'decision_rule_ids': ['CLS-2b', 'CLS-4:task_type', 'CLS-9']}
        assert put('t3', {'workflow_id': 'standard'}, jev.record_fields(out))[0] == 0 and load('t3')['decision_rule_ids'] == ['CLS-2b', 'CLS-4', 'CLS-9']
        assert check()[0] == 0
    print('self-test ok')


if __name__ == '__main__':
    sys.exit(self_test() if sys.argv[1:] == ['--self-test'] else main(sys.argv[1:]))
