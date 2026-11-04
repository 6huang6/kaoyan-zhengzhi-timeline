# -*- coding: utf-8 -*-
"""Reassign four nodes so that every era boundary sits on its anchor event.

- 1949_lunrens / 1949_gongtong  (1949.06 / 1949.09) -> era 2 (before 开国大典 1949.10)
- 1956_tenrel  / 1956_cpc8      (1956.04 / 1956.09) -> era 3 (before 三大改造完成 1956.12)

Result: era boundaries = 五四运动 1919.5 / 新中国成立 1949.10 / 三大改造完成 1956.12
        / 真理标准讨论 1978.5 / 中共十八大 2012.11
"""
import json
import io
import sys

MOVES = {
    '1949_lunrens': 2,
    '1949_gongtong': 2,
    '1956_tenrel': 3,
    '1956_cpc8': 3,
}

path = 'data/master.json'
with io.open(path, encoding='utf-8') as f:
    nodes = json.load(f)

changed = 0
for n in nodes:
    tgt = MOVES.get(n['id'])
    if tgt and n['era'] != tgt:
        n['era'] = tgt
        changed += 1

nodes.sort(key=lambda n: (n['y'], n.get('mo') or 0, n.get('d') or 0, n['id']))
with io.open(path, 'w', encoding='utf-8', newline='\n') as f:
    json.dump(nodes, f, ensure_ascii=False, indent=1)
    f.write('\n')

print('moved %d nodes' % changed)
from collections import Counter
c = Counter(n['era'] for n in nodes)
firsts = {}
for n in nodes:
    firsts.setdefault(n['era'], n)
for e in sorted(c):
    print('era %d: %d nodes, first=%s %s.%s' % (e, c[e], firsts[e]['id'], firsts[e]['y'], firsts[e].get('mo') or 0))
