# -*- coding: utf-8 -*-
"""把 2027 考研政治大纲的「Ⅳ.考查内容」解析成结构化 JSON。

输入：src/ref/dagang2027.txt（从用户提供的 PDF 用 PyMuPDF 抽取）
输出：docs/outline2027.json，结构：
[
  {"part":"二、毛泽东思想和中国特色社会主义理论体系概论",
   "chapters":[{"no":"一","title":"导论",
                "sections":[{"no":"1","title":"毛泽东思想形成和发展","text":"..."}]}]}
]
以及 docs/outline2027-flat.md（便于人读/给 agent 用）。
"""
import json
import re
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src", "ref", "dagang2027.txt")

PART_RE = re.compile(r"^[一二三四五六]、(.+)$")
# 章：(一) 导论  ／  （一）导论
CHAP_RE = re.compile(r"^[(（]([一二三四五六七八九十]+)[)）]\s*(.+)$")
SEC_RE = re.compile(r"^(\d+)[.．]\s*(.+)$")
NOISE_RE = re.compile(r"^(第\s*\d+\s*页|考研大纲电子版|统考>>|联考>>|大纲发布后|【扫码发送)")


def clean(lines):
    out = []
    for ln in lines:
        s = ln.strip()
        if not s or NOISE_RE.match(s):
            continue
        out.append(s)
    return out


def parse():
    raw = open(SRC, encoding="utf-8").read().splitlines()
    lines = clean(raw)
    # 只取 Ⅳ.考查内容 之后
    try:
        start = next(i for i, s in enumerate(lines) if s.startswith("一、马克思主义基本原理"))
    except StopIteration:
        start = 0
    lines = lines[start:]

    parts = []
    cur_part = None
    cur_chap = None
    cur_sec = None

    def flush_part():
        if cur_part:
            parts.append(cur_part)

    def flush_chap():
        if cur_chap and cur_part is not None:
            cur_part["chapters"].append(cur_chap)

    def flush_sec():
        if cur_sec is not None and cur_chap is not None:
            cur_chap["sections"].append(cur_sec)

    for s in lines:
        m = PART_RE.match(s)
        if m:
            flush_sec(); cur_sec = None
            flush_chap(); cur_chap = None
            flush_part()
            cur_part = {"part": s, "chapters": []}
            continue
        m = CHAP_RE.match(s)
        if m and cur_part is not None:
            flush_sec(); cur_sec = None
            flush_chap()
            cur_chap = {"no": m.group(1), "title": m.group(2).strip(), "sections": []}
            continue
        m = SEC_RE.match(s)
        if m and cur_chap is not None:
            flush_sec()
            cur_sec = {"no": m.group(1), "title": m.group(2).strip(), "text": ""}
            continue
        # 正文
        if cur_chap is None:
            continue
        if cur_sec is None:
            # 章下没有编号节（导论类）→ 造成一个隐式节
            cur_sec = {"no": "0", "title": cur_chap["title"], "text": ""}
        cur_sec["text"] += s + "\n"
    flush_sec()
    flush_chap()
    flush_part()

    for p in parts:
        for c in p["chapters"]:
            if not c["sections"]:
                c["sections"].append({"no": "0", "title": c["title"], "text": ""})
            for sec in c["sections"]:
                sec["text"] = sec["text"].strip()
                sec["points"] = [x.strip() for x in re.split(r"[。\n]", sec["text"]) if x.strip()]
    return parts


def flat(parts):
    out = []
    for p in parts:
        out.append("# " + p["part"])
        for c in p["chapters"]:
            out.append("## （%s）%s" % (c["no"], c["title"]))
            for sec in c["sections"]:
                if sec["no"] == "0":
                    out.append(sec["text"])
                else:
                    out.append("### %s. %s" % (sec["no"], sec["title"]))
                    out.append(sec["text"])
            out.append("")
    return "\n".join(out)


if __name__ == "__main__":
    parts = parse()
    with open(os.path.join(ROOT, "docs", "outline2027.json"), "w", encoding="utf-8") as f:
        json.dump(parts, f, ensure_ascii=False, indent=1)
    md = flat(parts)
    with open(os.path.join(ROOT, "docs", "outline2027-flat.md"), "w", encoding="utf-8") as f:
        f.write(md + "\n")
    for p in parts:
        print(p["part"], "->", len(p["chapters"]), "章",
              sum(len(c["sections"]) for c in p["chapters"]), "节")
    print("chars:", len(md))
