#!/usr/bin/env python3
"""Wait on Herdr agents; run with the Bash tool's run_in_background instead of `sleep 600`.

Usage: watch.py <agent> [<agent> ...] [--timeout S] [--interval 5]     Self-test: watch.py --self-test
Returns when an agent's status differs from its status at start (changed), its visible screen shows a
permission prompt (prompt), it is no longer listed (gone), or the heartbeat timeout passes (silent).
Prints one line per agent: <name> <old>-><new> <changed|prompt|gone|silent|unchanged>.
Exit 0 something happened, 2 heartbeat timeout (count it: two silent returns -> BLOCKED), 1 usage or unknown agent."""
import argparse, json, re, subprocess, sys, time

from paths import ROUTING

PROMPT = re.compile(r'Requesting permission for:|Run this command\?|Allow access to this file\?|Allow (creation|edits?|modification)'
                    r'|Trust this folder|hooks need review|esc close', re.I)


def sh(args):
    return subprocess.run(args, capture_output=True, text=True)


def heartbeat_s():
    pol = json.loads((ROUTING / 'jev_task_routing.json').read_text(encoding='utf-8'))
    return pol['delegation']['liveness']['heartbeat_interval_ms'] / 1000


def probe(names, run=sh):
    """{name: (status, visible screen)} for the watched agents still listed; the screen only when not working."""
    agents = {a.get('name'): a.get('agent_status') for a in json.loads(run(['herdr', 'agent', 'list']).stdout)['result']['agents']}
    return {n: (agents[n], run(['herdr', 'agent', 'read', n, '--source', 'visible', '--lines', '40']).stdout if agents[n] != 'working' else '')
            for n in names if n in agents}


def watch(names, timeout, interval, probe=probe, clock=time.monotonic, sleep=time.sleep):
    seen = probe(names)
    unknown = [n for n in names if n not in seen]
    if unknown:
        return 1, [f'unknown agent(s): {" ".join(unknown)}']
    base, end = {n: seen[n][0] for n in names}, clock() + timeout
    while True:
        events = {}
        for n in names:
            if n not in seen:
                events[n] = f'{base[n]}->- gone'
            elif seen[n][0] != base[n]:
                events[n] = f'{base[n]}->{seen[n][0]} changed'
            elif PROMPT.search(seen[n][1]):
                events[n] = f'{base[n]}->{seen[n][0]} prompt'
        if events:
            return 0, [f'{n} ' + (events[n] if n in events else f'{base[n]}->{seen[n][0]} unchanged') for n in names]
        if clock() >= end:
            return 2, [f'{n} {base[n]}->{base[n]} silent' for n in names]
        sleep(interval)
        seen = probe(names)


def self_test():
    agy_command = 'Requesting permission for:\ncurl -sL https://example.org/a | head -n 20\n\nRun this command?\n> Yes\n  No\nNavigate ↑↓  Select enter\n'
    agy_file = 'Allow access to this file?\nRead: /tmp/research-7/a.json\nReason: read the downloaded list\n> Yes\n  No\n'
    codex_hooks = 'Hooks need review\n  1. Trust and run hooks\n  2. Review hooks\n  3. Continue without trusting\n'
    working = '● Running npm run lint…\n  ⎿  eslint .\n✻ Thinking… (esc to interrupt)\n'
    idle = '╭────────────────────────────╮\n│ >                          │\n╰────────────────────────────╯\n  ? for shortcuts\n'
    codex_hooks_v167 = '⚠ 3 hooks need review before they can run.\n\n  .codex/hooks.toml: 3 hooks\n\n  t trust all · enter review · esc close\n'
    assert all(PROMPT.search(s) for s in (agy_command, agy_file, codex_hooks, codex_hooks_v167))
    assert not PROMPT.search(working) and not PROMPT.search(idle)

    def run_with(polls):
        t, it = [0.0], iter(polls)

        def probe_(names):
            return next(it, polls[-1])

        def sleep(s):
            t[0] += s
        return watch(['a', 'b'], 30, 5, probe_, lambda: t[0], sleep), t[0]

    calm = {'a': ('working', ''), 'b': ('idle', idle)}
    (code, lines), _ = run_with([calm, calm, {'a': ('idle', idle), 'b': ('idle', idle)}])
    assert code == 0 and lines == ['a working->idle changed', 'b idle->idle unchanged'], lines
    (code, lines), _ = run_with([calm, {'a': ('working', ''), 'b': ('idle', agy_command)}])
    assert code == 0 and lines == ['a working->working unchanged', 'b idle->idle prompt'], lines
    (code, lines), _ = run_with([calm, {'a': ('working', '')}])
    assert code == 0 and lines == ['a working->working unchanged', 'b idle->- gone'], lines
    (code, lines), elapsed = run_with([calm])
    assert code == 2 and lines == ['a working->working silent', 'b idle->idle silent'] and elapsed == 30, (lines, elapsed)
    assert watch(['a', 'zz'], 30, 5, lambda names: calm, lambda: 0, lambda s: None)[0] == 1
    assert heartbeat_s() == 600
    print('self-test ok')


def main(argv):
    if argv == ['--self-test']:
        self_test()
        return 0
    ap = argparse.ArgumentParser(usage=__doc__)
    ap.add_argument('agents', nargs='+')
    ap.add_argument('--timeout', type=float)
    ap.add_argument('--interval', type=float, default=5)
    try:
        a = ap.parse_args(argv)
    except SystemExit:
        return 1  # exit 2 means a heartbeat timeout
    code, lines = watch(a.agents, a.timeout or heartbeat_s(), a.interval)
    print('\n'.join(lines))
    return code


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
