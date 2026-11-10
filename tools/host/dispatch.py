#!/usr/bin/env python3
"""Start a worker on an issued order: order check -> role -> agent start -> pane_id in the record -> prompt -> working.

Usage: dispatch.py <task_id> <order_id> --name <agent> (--pane <id> | --split <pane_id> [--direction right|down])
                   [--cwd <dir>] [--no-start] [--dry-run]
       dispatch.py --self-test
Last line: DISPATCHED ... (0) | REFUSED <reason> (2) | MANUAL <what to do>, then rerun with --no-start (3)
           | NOT_WORKING ... (4). Only exit 0 means the worker started."""
import argparse, json, re, shlex, subprocess, sys, time

import record
from paths import HOST, NOTES, ROUTING

ORDERS = NOTES / 'orders'  # self-tests point this at a temp folder
DIALOGS = (('Trust this folder', ['enter']), ('Hooks need review', ['down', 'down', 'enter']))  # codex startup


def sh(args):
    return subprocess.run([str(a) for a in args], capture_output=True, text=True)


def launch_args(harness, model, effort):
    """The single source of launch flags per harness; None for an unknown harness."""
    if harness == 'claude':
        return ['--model', model if model.startswith('claude-') else f'claude-{model}', '--effort', effort, '--dangerously-skip-permissions']
    if harness == 'codex':
        return ['-m', model, '-c', f'model_reasoning_effort={effort}', '--dangerously-bypass-approvals-and-sandbox']
    if harness == 'agy':  # no permission bypass: researchers run under approve.py
        return ['--model', f'{model}-{effort}']
    if harness == 'opencode':  # no model flag: picked by hand with /model
        return ['--auto']
    return None


def order_problem(order_id):
    p = ORDERS / f'{order_id}.md'
    if not p.is_file():
        return f'no order file {p}'
    text = p.read_text(encoding='utf-8')
    if not text.startswith(f'# Work order {order_id} '):
        return f'first line of {p.name} is not "# Work order {order_id} ..."'
    if f'herdr agent prompt {HOST} "RESULT_SUBMITTED {order_id}:' not in text.rsplit('\n## ', 1)[-1]:
        return f'the last section of {p.name} has no report command for {order_id}'
    if re.search(r'@[A-Z][A-Z0-9_]*@', text):
        return f'{p.name} has an unfilled @PLACEHOLDER@'
    return None


def agent(run, name):
    r = run(['herdr', 'agent', 'get', name])
    try:
        return json.loads(r.stdout)['result']['agent'] if r.returncode == 0 else {}
    except (ValueError, KeyError):
        return {}


def wait_working(run, sleep, name, seconds):
    for _ in range(seconds):
        status = agent(run, name).get('agent_status')
        if status == 'working':
            return status
        sleep(1)
    return status


def dispatch(a, run=sh, sleep=time.sleep):
    """Returns (exit code, last line)."""
    problem = order_problem(a.order_id)
    code, lines = record.check([a.task_id]) if not problem else (0, [])
    if not problem and code:
        problem = f'record {a.task_id} does not pass record.py check: ' + ' | '.join(lines[:3])
    order = {} if problem else (record.load(a.task_id).get('role_work_items') or {}).get(a.order_id) or {}
    if not problem and not order.get('role_id'):
        problem = f'record {a.task_id} has no role_work_items[{a.order_id}] with a role_id'
    if problem:
        return 2, f'REFUSED {problem}'

    r = run(['python3', ROUTING / 'resolve_models.py', '--role', order['role_id'], '--json'])
    if r.returncode != 0:
        return 2, f'REFUSED resolve_models.py --role {order["role_id"]} exited {r.returncode}: {(r.stderr or r.stdout).strip()[:200]}'
    res = json.loads(r.stdout)['roles'][order['role_id']]['resolved']
    harness, model, effort = (res[f]['value'] for f in ('harness', 'model', 'effort'))
    args = launch_args(harness, model or '', effort or '')
    if args is None or not model or not effort:
        return 2, f'REFUSED no launch flags for harness={harness} model={model} effort={effort}'

    prompt = (f'You are a worker. Read your work order at {ORDERS / f"{a.order_id}.md"} and carry it out exactly, '
              'including the herdr report command at the end.')
    if a.dry_run:
        pane = a.pane or '<new-pane>'
        if not a.no_start:
            if a.split:
                print(shlex.join(['herdr', 'pane', 'split', a.split, '--direction', a.direction, '--cwd', a.cwd or order.get('workspace') or '.', '--no-focus']))
            print(shlex.join(['herdr', 'agent', 'start', a.name, '--kind', harness, '--pane', pane, '--timeout', '60000', '--', *args]))
        print(shlex.join(['herdr', 'agent', 'prompt', a.name, prompt]))
        return 0, f'DRY_RUN {a.order_id} agent={a.name} role={order["role_id"]} harness={harness}'

    if a.no_start:
        pane = agent(run, a.name).get('pane_id')
        if not pane:
            return 2, f'REFUSED no agent named {a.name}'
    else:
        pane = a.pane
        if a.split:
            r = run(['herdr', 'pane', 'split', a.split, '--direction', a.direction, '--cwd', a.cwd or order.get('workspace') or '.', '--no-focus'])
            try:
                pane = json.loads(r.stdout)['result']['pane']['pane_id']
            except (ValueError, KeyError, TypeError):
                return 3, f'MANUAL pane split failed ({(r.stderr or r.stdout).strip()[:200]}): make a pane, then rerun with --pane'
        started = run(['herdr', 'agent', 'start', a.name, '--kind', harness, '--pane', pane, '--timeout', '60000', '--', *args]).returncode == 0
    code, lines = record.set_pane(a.task_id, a.order_id, pane)  # ORDER-9: the record names the pane before anything else
    if code:
        return 2, f'REFUSED could not record pane {pane}: ' + ' | '.join(lines[:3])

    if not a.no_start:
        for _ in range(3):
            if started:
                break
            screen = run(['herdr', 'pane', 'read', pane, '--source', 'visible', '--lines', '15']).stdout
            keys = next((k for text, k in DIALOGS if text in screen), None)
            if keys is None:
                break
            run(['herdr', 'pane', 'send-keys', pane, *keys])
            sleep(3)
            started = agent(run, a.name).get('interactive_ready') is True
        if not started:
            screen = run(['herdr', 'pane', 'read', pane, '--source', 'visible', '--lines', '15']).stdout
            if screen.strip():
                print(screen.rstrip(), file=sys.stderr)
            return 3, f'MANUAL {a.name} in pane {pane} is not ready (screen above): fix it by hand, then rerun with --no-start'
        if harness == 'opencode':
            return 3, f'MANUAL pick the {model} model in {a.name} with /model as docs/agents/herdr.md says, then rerun with --no-start'

    run(['herdr', 'agent', 'prompt', a.name, prompt])
    status = wait_working(run, sleep, a.name, 15)
    if status != 'working':
        run(['herdr', 'agent', 'send-keys', a.name, 'enter'])  # a prompt can sit unsubmitted in the input box
        status = wait_working(run, sleep, a.name, 10)
    if status != 'working':
        return 4, f'NOT_WORKING {a.order_id} pane={pane} status={status}'
    return 0, f'DISPATCHED {a.order_id} agent={a.name} pane={pane} status=working'


def parse(argv):
    ap = argparse.ArgumentParser(usage=__doc__)
    ap.add_argument('task_id')
    ap.add_argument('order_id')
    ap.add_argument('--name', required=True)
    g = ap.add_mutually_exclusive_group()
    g.add_argument('--pane')
    g.add_argument('--split')
    ap.add_argument('--direction', choices=('right', 'down'), default='right')
    ap.add_argument('--cwd')
    ap.add_argument('--no-start', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args(argv)
    if not (a.pane or a.split or a.no_start):
        ap.error('one of --pane, --split or --no-start is required')
    return a


def self_test():
    import tempfile
    from pathlib import Path
    global ORDERS
    assert launch_args('claude', 'fable-5-2', 'high') == ['--model', 'claude-fable-5-2', '--effort', 'high', '--dangerously-skip-permissions']
    assert launch_args('claude', 'claude-opus-5-5', 'high') == ['--model', 'claude-opus-5-5', '--effort', 'high', '--dangerously-skip-permissions']
    assert launch_args('codex', 'gpt-6.1-terra', 'xhigh') == ['-m', 'gpt-6.1-terra', '-c', 'model_reasoning_effort=xhigh', '--dangerously-bypass-approvals-and-sandbox']
    assert launch_args('agy', 'gemini-4-argon', 'high') == ['--model', 'gemini-4-argon-high']
    assert launch_args('opencode', 'zai-coding-plan/glm-5.3-flash', 'max') == ['--auto']
    assert launch_args('gemini', 'x', 'high') is None
    report = f'## Report\n`herdr agent prompt {HOST} "RESULT_SUBMITTED @ORDER@: done"`\n'

    with tempfile.TemporaryDirectory() as tmp:
        ORDERS, record.TASKS = Path(tmp) / 'orders', Path(tmp) / 'tasks'
        ORDERS.mkdir(), record.TASKS.mkdir()
        assert record.put('t1', {'role_work_items': {'o1': {'role_id': 'planner'}, 'o2': {}, 'o3': {'role_id': 'planner'}}})[0] == 0

        def order(oid, body=None):
            (ORDERS / f'{oid}.md').write_text(body if body is not None else f'# Work order {oid} (revision 1)\n\n## Objective\nx\n\n' + report.replace('@ORDER@', oid))

        def fake(statuses, harness='claude', start_rc=0, screen=''):
            calls, seen = [], iter(statuses)

            def run(args):
                args = [str(x) for x in args]
                out, rc = '', 0
                if args[0] == 'python3':
                    calls.append('resolve')
                    out = json.dumps({'roles': {'planner': {'resolved': {'harness': {'value': harness}, 'model': {'value': 'fable-5-2'}, 'effort': {'value': 'high'}}}}})
                else:
                    verb = args[2]
                    calls.append(verb)
                    if verb == 'split':
                        out = json.dumps({'result': {'pane': {'pane_id': 'w9:p2'}}})
                    elif verb == 'start':
                        rc = start_rc
                    elif verb == 'prompt':  # the pane id is recorded before the prompt goes out
                        assert record.load('t1')['role_work_items'][a.order_id]['pane_id'] == 'w9:p2'
                    elif verb == 'get':
                        out = json.dumps({'result': {'agent': {'agent_status': next(seen, statuses[-1]), 'pane_id': 'w9:p2'}}})
                    elif verb == 'read':
                        out = screen
                return subprocess.CompletedProcess(args, rc, out, '')
            return run, calls

        cases = {'o9': None, 'o2': f'# Work order o2 (revision 1)\n\n## Report\nnone\n',
                 'o4': report.replace('@ORDER@', 'o1'), 'o5': '@N@'}
        for oid, body in cases.items():
            if body is not None:
                order(oid, f'# Work order {oid} (revision 1)\n\n{body}' if oid != 'o2' else body)
            if oid == 'o5':
                order(oid, f'# Work order o5 (revision 1)\nAgent @N@\n\n' + report.replace('@ORDER@', 'o5'))
            a = parse(['t1', oid, '--name', 'w', '--split', 'w9:p1'])
            run, calls = fake(['working'])
            code, last = dispatch(a, run, lambda s: None)
            assert code == 2 and last.startswith('REFUSED') and calls == [], (oid, last, calls)
        order('o6')  # order file fine, but not in the record
        run, calls = fake(['working'])
        assert dispatch(parse(['t1', 'o6', '--name', 'w', '--split', 'w9:p1']), run, lambda s: None)[0] == 2 and calls == []

        order('o1')
        a = parse(['t1', 'o1', '--name', 'w', '--split', 'w9:p1'])
        run, calls = fake(['working'])
        assert dispatch(a, run, lambda s: None) == (0, 'DISPATCHED o1 agent=w pane=w9:p2 status=working')
        assert calls == ['resolve', 'split', 'start', 'prompt', 'get'], calls
        run, calls = fake(['idle'] * 15 + ['working'])
        assert dispatch(a, run, lambda s: None)[0] == 0 and calls.count('send-keys') == 1
        record.put('t1', {'role_work_items': {'o1': {'pane_id': None}}})
        run, calls = fake(['idle'])
        assert dispatch(a, run, lambda s: None) == (4, 'NOT_WORKING o1 pane=w9:p2 status=idle') and calls.count('send-keys') == 1
        assert record.load('t1')['role_work_items']['o1']['pane_id'] == 'w9:p2'
        run, calls = fake(['working'], harness='gemini')
        assert dispatch(a, run, lambda s: None)[0] == 2 and calls == ['resolve']
        run, calls = fake(['working'], start_rc=1)
        assert dispatch(a, run, lambda s: None)[0] == 3 and 'prompt' not in calls
        run, calls = fake(['working'], harness='opencode')
        assert dispatch(a, run, lambda s: None)[0] == 3 and 'prompt' not in calls
        run, calls = fake(['working'])
        assert dispatch(parse(['t1', 'o1', '--name', 'w', '--no-start']), run, lambda s: None)[0] == 0 and 'start' not in calls
    print('self-test ok')


if __name__ == '__main__':
    if sys.argv[1:] == ['--self-test']:
        self_test()
        sys.exit(0)
    code, last = dispatch(parse(sys.argv[1:]))
    print(last)
    sys.exit(code)
