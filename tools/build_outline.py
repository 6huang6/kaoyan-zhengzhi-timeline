# -*- coding: utf-8 -*-
"""Generate data/outline.js — the 2027 syllabus tree (parts → chapters → sections → items).

Source: docs/outline2027.json (parsed from the user-supplied 2027 syllabus PDF).
Only the three parts this tool covers are exported: 史纲 / 毛中特 / 习思想.
Each section's items are the syllabus' own bullet points, taken from its `text`
(joined lines, split by 。) — nothing is added or rewritten.
"""
import io
import json
import re

SRC = 'docs/outline2027.json'
OUT = 'data/outline.js'

WANT = [('四、中国近现代史纲要', '史纲'), ('二、毛泽东思想和中国特色社会主义理论体系概论', '毛中特'), ('三、习近平新时代中国特色社会主义思想概论', '习思想')]
CN = '一二三四五六七八九十'


def items_of(text):
    s = re.sub(r'\s+', '', text or '')
    out = []
    for piece in s.split('。'):
        piece = piece.strip('，、；： ')
        if piece:
            out.append(piece)
    return out


def cn_num(no):
    """'十二' -> 12, '一' -> 1 (fallback: keep order)."""
    if no is None:
        return 0
    s = str(no).strip()
    if s.isdigit():
        return int(s)
    if s == '十':
        return 10
    if '十' in s:
        a, _, b = s.partition('十')
        return (CN.index(a) + 1 if a else 1) * 10 + (CN.index(b) + 1 if b else 0)
    return CN.index(s) + 1 if s in CN else 0


def main():
    src = json.load(io.open(SRC, encoding='utf-8'))
    by_part = {p['part']: p for p in src}
    parts = []
    for full, short in WANT:
        p = by_part.get(full)
        if not p:
            raise SystemExit('missing part: ' + full)
        chapters = []
        for ci, ch in enumerate(p['chapters'], 1):
            secs = []
            for si, sec in enumerate(ch.get('sections') or [], 1):
                secs.append({'no': si, 'title': sec.get('title', ''), 'items': items_of(sec.get('text'))})
            chapters.append({'no': ci, 'cn': ch.get('no') or str(ci), 'title': ch.get('title', ''), 'secs': secs})
        parts.append({'key': short, 'name': full, 'chapters': chapters})

    data = {'generatedFrom': '2027 考研政治大纲（用户提供的 PDF）', 'parts': parts}
    js = 'window.OUTLINE = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write(js)

    for p in parts:
        n_sec = sum(len(c['secs']) for c in p['chapters'])
        n_item = sum(len(s['items']) for c in p['chapters'] for s in c['secs'])
        print('%s: %d 章 %d 节 %d 条目' % (p['key'], len(p['chapters']), n_sec, n_item))
    print('wrote', OUT, len(js), 'bytes')


if __name__ == '__main__':
    main()
