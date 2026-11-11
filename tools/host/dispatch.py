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
# codex startup screens, each identified by its own text; first match wins.
HOOKS = re.compile(r'hooks need review', re.I)
DIALOGS = ((re.compile(r'hooks need review.*(esc close|t trust all|Lifecycle hooks)|(esc close|t trust all|Lifecycle hooks).*hooks need review',
                       re.I | re.S), ['esc']),  # v0.167
           (re.compile(r'hooks need review.*continue without trusting', re.I | re.S), ['down', 'down', 'enter']),  # old menu
           (re.compile(r'trust this folder', re.I), ['enter']))
UNKNOWN = 'unknown'  # some other hooks screen (for example cut off): no keys, the host looks
# each harness's own input-box mark: `agent start` can report ready while the shell still shows (agy, 2026-11-11)
# claude: the input footer from --dangerously-skip-permissions; its `❯` prompt glyph is a shell prompt too
READY = {'agy': re.compile(r'\? for shortcuts'), 'codex': re.compile(r'Ask Codex'), 'claude': re.compile(r'bypass permissions on')}


def dialog_keys(screen):
    """Keys that answer a known startup dialog, UNKNOWN for an unrecognised hooks screen, None for no dialog.
    Hooks text that is neither known hooks screen wins over every other match, `trust this folder` included."""
    if HOOKS.search(screen):
        return next((k for pat, k in DIALOGS[:2] if pat.search(screen)), UNKNOWN)
    return next((k for pat, k in DIALOGS[2:] if pat.search(screen)), None)


def screen_of(run, pane):
    """The visible screen, or None when it cannot be read (never taken as a clear screen)."""
    r = run(['herdr', 'pane', 'read', pane, '--source', 'visible', '--lines', '15'])
    return r.stdout if r.returncode == 0 else None


def sh(args):
    return subprocess.run([str(a) for a in args], capture_output=True, text=True)


def launch_args(harness, model, effort):
    """The single source of launch flags per harness; None for an unknown harness."""
    if harness == 'claude':
        return ['--model', model if model.startswith('claude-') else f'claude-{model}', '--effort', effort, '--dangerously-skip-permissions']
    if harness == 'codex':
        return ['-m', model, '-c', f'model_reasoning_effort={effort}', '--dangerously-bypass-approvals-and-sandbox']
    if harness == 'agy':  # no permission bypass: the host approves each researcher command by hand (issue #89)
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


def dispatch(a, run=sh, sleep=time.sleep, clock=time.monotonic):
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

    screen, rounds, mark = screen_of(run, pane), 0, None if a.no_start else READY.get(harness)
    deadline = clock() + 30
    while not a.no_start:  # answer known startup dialogs (3 rounds) and wait for the mark, 30 s in all
        keys = None if screen is None else dialog_keys(screen)
        if screen is None or keys == UNKNOWN or rounds == 3 and keys:
            break
        if not keys and (not mark or mark.search(screen)):
            break
        left = deadline - clock()
        if left <= 0:
            break
        if keys:
            rounds += 1
            run(['herdr', 'pane', 'send-keys', pane, *keys])
            sleep(min(3, left))
            started = started or agent(run, a.name).get('interactive_ready') is True
        else:
            sleep(min(1, left))
        if clock() >= deadline:  # no screen is read after the deadline, so none counts as ready late
            break
        screen = screen_of(run, pane)
    if screen is None:
        return 3, f'MANUAL screen unreadable: herdr pane read {pane} failed; check {a.name} by hand, then rerun with --no-start'
    keys = dialog_keys(screen)
    if keys or not (a.no_start or started):
        if screen.strip():
            print(screen.rstrip(), file=sys.stderr)
        what = 'unknown hooks screen' if keys == UNKNOWN else 'not ready'
        return 3, f'MANUAL {what}: {a.name} in pane {pane} (screen above); fix it by hand, then rerun with --no-start'
    if mark and not mark.search(screen):
        if screen.strip():
            print(screen.rstrip(), file=sys.stderr)
        return 3, f'MANUAL not ready: {a.name} shows no ready mark in pane {pane} (screen above); fix it by hand, then rerun with --no-start'
    if not a.no_start and harness == 'opencode':
        return 3, f'MANUAL pick the {model} model in {a.name} with /model as docs/agents/herdr.md says, then rerun with --no-start'
    info = agent(run, a.name)  # only a free agent can take the order, so a later `working` belongs to it
    if info.get('agent_status') not in ('idle', 'done') or info.get('interactive_ready') is not True:
        return 3, (f'MANUAL agent busy or unknown: {a.name} is {info.get("agent_status")} (interactive_ready={info.get("interactive_ready")}); '
                   'wait until it is idle or done, then rerun with --no-start')

    r = run(['herdr', 'agent', 'prompt', a.name, prompt])
    if r.returncode != 0:
        return 4, f'NOT_WORKING {a.order_id} pane={pane} prompt failed (exit {r.returncode})'
    status = wait_working(run, sleep, a.name, 15)
    if status != 'working':
        run(['herdr', 'agent', 'send-keys', a.name, 'enter'])  # a prompt can sit unsubmitted in the input box
        status = wait_working(run, sleep, a.name, 10)
    if status == 'working':  # not working before the send, working now and still 3 s later, no dialog on screen
        sleep(3)
        status = agent(run, a.name).get('agent_status')
        after = screen_of(run, pane)
        keys = None if after is None else dialog_keys(after)
        if not a.no_start and keys and keys != UNKNOWN:  # codex can show its hooks screen after taking the prompt (2026-11-11): answer once
            run(['herdr', 'pane', 'send-keys', pane, *keys])
            sleep(3)
            status = agent(run, a.name).get('agent_status')
            after = screen_of(run, pane)
        status = 'screen-unreadable' if after is None else 'startup-dialog-on-screen' if dialog_keys(after) else status
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
    import contextlib, io, tempfile
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

        claude_ui = '────\n❯ \n────\n  ⏵⏵ bypass permissions on (shift+tab to cycle)\n'  # footer seen live 2026-11-11

        def fake(statuses, harness='claude', start_rc=0, screens=(claude_ui,), prompt_rc=0, ready=True):
            calls, seen, shown = [], iter(statuses), iter(screens)

            def run(args):
                args = [str(x) for x in args]
                out, rc = '', 0
                if args[0] == 'python3':
                    calls.append('resolve')
                    out = json.dumps({'roles': {'planner': {'resolved': {'harness': {'value': harness}, 'model': {'value': 'fable-5-2'}, 'effort': {'value': 'high'}}}}})
                else:
                    verb = args[2]
                    calls.append(f'pane-keys {" ".join(args[4:])}' if args[1:3] == ['pane', 'send-keys'] else verb)
                    if verb == 'split':
                        out = json.dumps({'result': {'pane': {'pane_id': 'w9:p2'}}})
                    elif verb == 'start':
                        rc = start_rc
                    elif verb == 'prompt':  # the pane id is recorded before the prompt goes out
                        assert record.load('t1')['role_work_items'][a.order_id]['pane_id'] == 'w9:p2'
                        rc = prompt_rc
                    elif verb == 'get':
                        out = json.dumps({'result': {'agent': {'agent_status': next(seen, statuses[-1]), 'pane_id': 'w9:p2', 'interactive_ready': ready}}})
                    elif verb == 'read':  # None: the read fails
                        out = next(shown, screens[-1])
                        out, rc = ('', 1) if out is None else (out, 0)
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
        clock = [0.0]  # one fake clock for every case below: the ready wait never spins on real time
        nap, now = lambda s: clock.__setitem__(0, clock[0] + s), lambda: clock[0]
        run, calls = fake(['idle', 'working'])
        assert dispatch(a, run, nap, now) == (0, 'DISPATCHED o1 agent=w pane=w9:p2 status=working')
        assert calls == ['resolve', 'split', 'start', 'read', 'get', 'prompt', 'get', 'get', 'read'], calls
        run, calls = fake(['idle'] * 16 + ['working'])
        assert dispatch(a, run, nap, now)[0] == 0 and calls.count('send-keys') == 1
        record.put('t1', {'role_work_items': {'o1': {'pane_id': None}}})
        run, calls = fake(['idle'])
        assert dispatch(a, run, nap, now) == (4, 'NOT_WORKING o1 pane=w9:p2 status=idle') and calls.count('send-keys') == 1
        assert record.load('t1')['role_work_items']['o1']['pane_id'] == 'w9:p2'
        run, calls = fake(['idle'], harness='gemini')
        assert dispatch(a, run, nap, now)[0] == 2 and calls == ['resolve']
        run, calls = fake(['idle'], start_rc=1, screens=('',))
        assert dispatch(a, run, nap, now)[0] == 3 and 'prompt' not in calls
        run, calls = fake(['idle'], harness='opencode')
        assert dispatch(a, run, nap, now)[0] == 3 and 'prompt' not in calls
        no_start = parse(['t1', 'o1', '--name', 'w', '--no-start'])
        run, calls = fake(['idle', 'idle', 'working'])
        assert dispatch(no_start, run, nap, now)[0] == 0 and 'start' not in calls
        # S1: start reports ready while the pane still shows the shell; the prompt waits for the harness's own mark
        shell = 'user@host:~/wt$ agy --model fable-5-2-high\n'
        banner = shell + '\n  Antigravity CLI\n\n  > \n  ? for shortcuts\n'
        run, calls = fake(['idle', 'working'], harness='agy', screens=[shell, shell, banner])
        assert dispatch(a, run, nap, now)[0] == 0, calls
        assert calls[:calls.index('prompt')].count('read') == 3, calls
        with contextlib.redirect_stderr(io.StringIO()):
            run, calls = fake(['idle', 'working'], harness='agy', screens=[shell])  # the mark never comes
            code, last = dispatch(a, run, nap, now)
        assert code == 3 and last.startswith('MANUAL not ready: w shows no ready mark') and 'prompt' not in calls, (last, calls)
        # R2: a failed prompt is never a dispatch
        run, calls = fake(['idle', 'working'], prompt_rc=1)
        assert dispatch(a, run, nap, now) == (4, 'NOT_WORKING o1 pane=w9:p2 prompt failed (exit 1)') and calls.count('send-keys') == 0
        # D2: a busy agent gets no prompt, so a later `working` always belongs to the new order
        for args, status, ready in ((no_start, 'working', True), (a, 'working', True), (no_start, 'idle', False),
                                    (no_start, 'unknown', True), (a, 'blocked', True), (no_start, None, True)):
            run, calls = fake([status], ready=ready)
            code, last = dispatch(args, run, nap, now)
            assert code == 3 and last.startswith('MANUAL agent busy or unknown') and 'prompt' not in calls, (status, last, calls)
        run, calls = fake(['done', 'working'])
        assert dispatch(a, run, nap, now)[0] == 0
        run, calls = fake(['idle', 'working', 'idle'])  # working once, idle 3 s later
        assert dispatch(a, run, nap, now) == (4, 'NOT_WORKING o1 pane=w9:p2 status=idle')
        # D3: a screen that cannot be read is never a clear screen
        run, calls = fake(['idle', 'working'], screens=[None])
        assert dispatch(a, run, nap, now)[1].startswith('MANUAL screen unreadable') and 'prompt' not in calls
        run, calls = fake(['idle', 'idle', 'working'], screens=[None])
        assert dispatch(no_start, run, nap, now)[0] == 3 and 'prompt' not in calls
        run, calls = fake(['idle', 'working'], screens=[claude_ui, None])
        assert dispatch(a, run, nap, now) == (4, 'NOT_WORKING o1 pane=w9:p2 status=screen-unreadable')
        # L1/D4: each codex dialog by its own text; any other hooks screen stops with no keys
        hooks_new = ('⚠ 3 hooks need review before they can run.\n\n  .codex/hooks.toml: 3 hooks\n\n'
                     '  t trust all · enter review · esc close\n')
        hooks_old = 'Hooks need review\n  1. Trust and run hooks\n  2. Review hooks\n  3. Continue without trusting\n'
        truncated = '⚠ 3 hooks need review before they can run.\n'
        assert dialog_keys(hooks_new) == ['esc'] and dialog_keys(hooks_old) == ['down', 'down', 'enter']
        assert dialog_keys('Lifecycle hooks\n⚠ 2 hooks need review before they can run.') == ['esc']
        assert dialog_keys(truncated) == UNKNOWN and dialog_keys('Hooks need review\n  1. Trust') == UNKNOWN
        assert dialog_keys('Do you trust this folder?') == ['enter'] and dialog_keys('› Ask Codex to do anything') is None
        combined = '⚠ 3 hooks need review before they can run.\nDo you trust this folder?'  # review-3 F4
        assert dialog_keys(combined) == UNKNOWN and dialog_keys(hooks_new + 'Do you trust this folder?') == ['esc']
        with contextlib.redirect_stderr(io.StringIO()):
            run, calls = fake(['idle'], screens=[combined])
            code, last = dispatch(a, run, nap, now)
            assert last.startswith('MANUAL unknown hooks screen') and not any(c.startswith('pane-keys') for c in calls), calls
        run, calls = fake(['idle', 'idle', 'working'], screens=[hooks_new, claude_ui])
        assert dispatch(a, run, nap, now)[0] == 0 and 'pane-keys esc' in calls and calls.index('pane-keys esc') < calls.index('prompt')
        run, calls = fake(['idle', 'idle', 'working'], screens=[hooks_old, claude_ui])
        assert dispatch(a, run, nap, now)[0] == 0 and 'pane-keys down down enter' in calls
        with contextlib.redirect_stderr(io.StringIO()):
            run, calls = fake(['idle'], screens=[hooks_new])  # the screen never closes
            assert dispatch(a, run, nap, now)[0] == 3 and 'prompt' not in calls and calls.count('pane-keys esc') == 3
            run, calls = fake(['idle'], screens=[truncated])
            code, last = dispatch(a, run, nap, now)
            assert code == 3 and last.startswith('MANUAL unknown hooks screen') and not any(c.startswith('pane-keys') for c in calls), calls
        run, calls = fake(['idle', 'working'], screens=[claude_ui, hooks_new])  # a dialog after the prompt: it never arrived
        assert dispatch(a, run, nap, now) == (4, 'NOT_WORKING o1 pane=w9:p2 status=startup-dialog-on-screen')
        # o3 review F3: a shell prompt with `❯` is not claude's input box
        with contextlib.redirect_stderr(io.StringIO()):
            run, calls = fake(['idle', 'working'], screens=['~/wt/observer\n❯ '])
            code, last = dispatch(a, run, nap, now)
        assert code == 3 and last.startswith('MANUAL not ready') and 'prompt' not in calls  # o3
        # o3 review F1: dialogs during the ready wait; an unknown hooks screen gets no keys and no prompt
        codex_ui = '› Ask Codex to do anything\n'
        with contextlib.redirect_stderr(io.StringIO()):
            run, calls = fake(['idle', 'working'], harness='codex', screens=[shell, 'Hooks need review\nAsk Codex'])
            code, last = dispatch(a, run, nap, now)
        assert code == 3 and last.startswith('MANUAL unknown hooks screen') and 'prompt' not in calls  # o3
        assert not any(c.startswith('pane-keys') for c in calls)  # o3
        run, calls = fake(['idle', 'working'], harness='codex', screens=[shell, hooks_new, codex_ui])
        code, last = dispatch(a, run, nap, now)
        assert code == 0 and 'pane-keys esc' in calls and calls.index('pane-keys esc') < calls.index('prompt')  # o3
        # o3 review F2: a failed read during the wait stops at once
        run, calls = fake(['idle', 'working'], harness='agy', screens=[shell, None])
        code, last = dispatch(a, run, nap, now)
        assert code == 3 and last.startswith('MANUAL screen unreadable') and calls.count('read') == 2 and 'prompt' not in calls  # o3
        # o3 item 4: codex takes the prompt, then shows its hooks screen: answered once, then confirmed
        run, calls = fake(['idle', 'working'], harness='codex', screens=[codex_ui, hooks_new, codex_ui])
        code, last = dispatch(a, run, nap, now)
        assert code == 0 and calls.count('pane-keys esc') == 1 and calls.index('prompt') < calls.index('pane-keys esc')  # o3
        run, calls = fake(['idle', 'working'], harness='codex', screens=[codex_ui, truncated])
        code, last = dispatch(a, run, nap, now)
        assert code == 4 and last.endswith('status=startup-dialog-on-screen') and not any(c.startswith('pane-keys') for c in calls)  # o3
        # o5 review-2 F1: with --no-start a dialog during confirmation is exit 4 and gets no keys, as before
        run, calls = fake(['idle', 'idle', 'working'], harness='codex', screens=[codex_ui, hooks_new, codex_ui])
        code, last = dispatch(no_start, run, nap, now)
        assert code == 4 and last.endswith('status=startup-dialog-on-screen') and not any('send-keys' in c or c.startswith('pane-keys') for c in calls)  # o5
        # o5 review-2 F2: the ready wait ends 30 s after it starts by the clock, dialog rounds included
        for later in (codex_ui, shell):
            t = [0.0]
            tick = lambda s: t.__setitem__(0, t[0] + s)
            run, calls = fake(['idle', 'working'], harness='codex', screens=[hooks_new] + [shell] * 26 + [later] + [shell])
            with contextlib.redirect_stderr(io.StringIO()):
                code, last = dispatch(a, run, tick, clock=lambda: t[0])
            if later is codex_ui:  # the mark on the last read before 30 s still counts
                assert code == 0 and 'pane-keys esc' in calls  # o5
            else:  # one dialog round, then no mark: stops at the deadline
                assert code == 3 and last.startswith('MANUAL not ready: w shows no ready mark') and 'prompt' not in calls and t[0] == 30  # o7
        t = [0.0]
        run, calls = fake(['idle', 'working'], harness='codex', screens=[hooks_new] + [shell] * 28 + [codex_ui])
        with contextlib.redirect_stderr(io.StringIO()):
            code, last = dispatch(a, run, lambda s: t.__setitem__(0, t[0] + s), clock=lambda: t[0])
        assert code == 3 and 'prompt' not in calls  # o5: a mark read after the deadline is not accepted
        # o7 review-3 F1: a dialog first seen at 29 s gets at most the 1 s left, then the wait ends at 30 s
        t = [0.0]
        run, calls = fake(['idle', 'working'], harness='codex', screens=[shell] * 29 + [hooks_new] + [codex_ui])
        with contextlib.redirect_stderr(io.StringIO()):
            code, last = dispatch(a, run, lambda s: t.__setitem__(0, t[0] + s), clock=lambda: t[0])
        assert code == 3 and 'prompt' not in calls and t[0] == 30  # o7
        # R3: without jsonschema the record check refuses before any herdr call
        saved, sys.modules['jsonschema'] = sys.modules.get('jsonschema'), None
        try:
            run, calls = fake(['working'])
            code, last = dispatch(a, run, lambda s: None)
            assert code == 2 and 'jsonschema' in last and calls == [], (last, calls)
        finally:
            sys.modules['jsonschema'] = saved
        a = parse(['t1', 'o3', '--name', 'r', '--pane', 'w9:p2'])  # the committed researcher template
        tpl = (Path(__file__).parent / 'templates' / 'research-order.md').read_text(encoding='utf-8')
        order('o3', tpl)
        run, calls = fake(['working'])
        assert dispatch(a, run, lambda s: None)[0] == 2 and calls == []
        order('o3', tpl.replace('@ORDER@', 'o3'))
        assert 'PLACEHOLDER' in order_problem('o3')
        filled = re.sub(r'@([A-Z][A-Z0-9_]*)@', lambda m: 'o3' if m.group(1) == 'ORDER' else 'x', tpl)
        order('o3', filled)
        assert order_problem('o3') is None
    print('self-test ok')


if __name__ == '__main__':
    if sys.argv[1:] == ['--self-test']:
        self_test()
        sys.exit(0)
    code, last = dispatch(parse(sys.argv[1:]))
    print(last)
    sys.exit(code)
