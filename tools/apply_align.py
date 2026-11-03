# tools/apply_align.py — 把 docs/align-*.json 的对纲结果写入 data/master.json 的 ol 字段，并生成 docs/GAPS.md
import json, re, os, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
OL_RE = re.compile(r'^大纲·(史纲|毛中特|习思想|马原|思道|形势)\d+章(\d+节)?$')


def load(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def main():
    master = load(P('data', 'master.json'))
    by_id = {n['id']: n for n in master}
    sources = [('docs/align-shigang.json', '史纲'), ('docs/align-mao.json', '毛中特/习思想')]

    applied, bad, gaps_all, extra_all = 0, [], [], []
    for rel, label in sources:
        path = P(*rel.split('/'))
        if not os.path.exists(path):
            print(f'  ! 缺 {rel}，跳过')
            continue
        data = load(path)
        m = data.get('map') or {}
        for nid, ol in m.items():
            if nid not in by_id:
                bad.append(f'{rel}: {nid} 不在 master')
                continue
            if not OL_RE.match(str(ol)):
                bad.append(f'{rel}: {nid} ol 格式非法 {ol}')
                continue
            by_id[nid]['ol'] = ol
            applied += 1
        theory = data.get('theory') or {}
        for tid, ols in theory.items():
            for ol in ols:
                if not OL_RE.match(str(ol)):
                    bad.append(f'{rel}: theory {tid} ol 格式非法 {ol}')
        for g in data.get('gaps') or []:
            gaps_all.append(dict(g, part=label, src=rel))
        for e in data.get('extra') or []:
            e2 = dict(e, part=label, src=rel)
            if e2.get('id') in by_id:
                e2['label'] = by_id[e2['id']].get('label', '')
            extra_all.append(e2)

    # 同一节点可能被两份对齐表同时列为「超纲」，按 id 去重
    seen_extra, dedup = set(), []
    for e in extra_all:
        k = e.get('id')
        if k in seen_extra:
            continue
        seen_extra.add(k)
        dedup.append(e)
    extra_all = dedup
    covered = sum(1 for n in master if n.get('ol'))

    if bad:
        print('  发现问题：')
        for b in bad:
            print('   ✗', b)
    if not applied and bad:
        print('  未写入任何 ol，退出')
        sys.exit(1)

    # 按 (y, mo, d, id) 排序后写回，保持文件稳定
    master.sort(key=lambda n: (n.get('y') or 0, n.get('mo') or 0, n.get('d') or 0, n['id']))
    with open(P('data', 'master.json'), 'w', encoding='utf-8') as f:
        json.dump(master, f, ensure_ascii=False, indent=1)
        f.write('\n')

    # GAPS.md
    lines = ['# 大纲 vs 本项目：缺口与超纲清单', '',
             '生成自 `tools/apply_align.py`，数据源 `docs/align-shigang.json`、`docs/align-mao.json`。',
             '「缺口」= 大纲明确要求、本项目没有覆盖的考点；「超纲」= 本项目有、大纲找不到明确对应（多为教材背景性内容或时政）。', '']
    lines.append(f'## 一、覆盖率')
    lines.append('')
    lines.append(f'- 已写入大纲归属（`ol` 字段）的节点：**{covered} / {len(master)}**（另有 {len(master) - covered} 条无大纲对应，见第三节）')
    lines.append('')
    for part in ('史纲', '毛中特/习思想'):
        sub = [n for n in master if n.get('ol', '').startswith('大纲·史纲') == (part == '史纲')]
        lines.append(f'- {part}：{len(sub)} 条节点已对齐')
    lines.append('')
    lines.append(f'## 二、大纲有、本项目缺（{len(gaps_all)} 条）')
    lines.append('')
    if gaps_all:
        lines.append('| # | 大纲位置 | 考点 | 为什么缺 | 建议 | 教材依据 |')
        lines.append('| --- | --- | --- | --- | --- | --- |')
        for i, g in enumerate(gaps_all, 1):
            lines.append('| {} | {} | {} | {} | {} | {} |'.format(
                i, g.get('ol', ''), g.get('point', ''), g.get('why', ''),
                g.get('suggest', ''), g.get('evidence', '')))
    else:
        lines.append('（无）')
    lines.append('')
    lines.append(f'## 三、本项目有、大纲无明确对应（{len(extra_all)} 条）')
    lines.append('')
    if extra_all:
        lines.append('| # | 节点 | 年份 | 说明 |')
        lines.append('| --- | --- | --- | --- |')
        for i, e in enumerate(extra_all, 1):
            lines.append('| {} | {}（{}） | {} | {} |'.format(
                i, e.get('id', ''), e.get('label', ''), e.get('y', '') or '', e.get('reason', '')))
    else:
        lines.append('（无）')
    lines.append('')
    with open(P('docs', 'GAPS.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

    print(f'  ✓ ol 写入 {applied} 条；gaps {len(gaps_all)} 条；extra {len(extra_all)} 条；docs/GAPS.md 已生成')
    if bad:
        print(f'  另有 {len(bad)} 条问题未写入（见上）')


if __name__ == '__main__':
    main()
