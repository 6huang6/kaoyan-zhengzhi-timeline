# 大纲补遗：数据规范（writer 必读）

本文件是 `data/sup/*.json` 的唯一契约。你的任务清单在 `data/sup/PLAN.json`（按 `batch` 分组），
规范以本文件为准；两者冲突时先问我。

## 一、两种条目

| mode | 是什么 | 去向 |
|---|---|---|
| `node` | 有明确历史坐标、值得进时间线的新考点 | 追加进 `data/master.json` + 五段文案进 `data/parts/ol.json`，出现在时间线/地图/搜索里 |
| `note` | 概念型/理论型补遗，**不进时间线** | 进「脉络 → 大纲补遗」卡片，并在锚定考点的详情面板里挂一小节 |

`PLAN.json` 已给每条定好 `mode`、`ol`、`point`、`id`，`node` 条目还给了 `node` 元数据（年月、标题、时期、轨道、类型、教材章节、地点、省份、线索）。**不要改这些字段**，只填文案。

## 二、输出格式

你的产出是一个 JSON 数组文件（文件名见 `PLAN.json` 的 `out`），例如 `data/sup/wa.json`：

```json
[
  {
    "id": "sup-sg-1",
    "mode": "note",
    "part": "史纲",
    "ol": "大纲·史纲1章1节",
    "point": "近代中国的社会主要矛盾和两大历史任务",
    "star": 5,
    "anchor": "1840_opium_war",
    "kw": ["两大历史任务", "民族独立", "人民解放"],
    "ev": "gangyao.txt:341 中国近代社会的主要矛盾……这是近代以来中华民族面临的两大历史任务。",
    "sec": {
      "main": "……",
      "tip": "……",
      "mix": "……"
    }
  },
  {
    "id": "1927_nanjing_gov",
    "mode": "node",
    "part": "史纲",
    "ol": "大纲·史纲5章1节",
    "point": "国民党在全国统治的建立及其性质",
    "star": 4,
    "kw": ["宁汉合流", "一党专政", "军事独裁"],
    "ev": "gangyao.txt:1061 一党专政的军事独裁统治……",
    "node": { "y": 1927, "mo": 4, "d": 18, "label": "南京国民政府成立", "era": 2, "track": "s", "cat": "事件", "ch": "纲要·5章1节", "place": "南京", "prov": "江苏", "threads": ["path", "party"] },
    "sec": {
      "bg": "……",
      "main": "……",
      "sig": "……",
      "tip": "……",
      "mix": "……"
    }
  }
]
```

字段说明：

- `id` / `mode` / `part` / `ol` / `point` / `anchor`（note 必填）/ `node`（node 必填）：照抄 `PLAN.json`，不许改。
- `star`：1–5 的整数，考频经验估计（不是官方数据）。
- `kw`：3–6 个关键词，**必须能在正文里出现**，供搜索与详情面板用。
- `ev`：教材依据，`文件名:行号` + 原文摘录（可截断），如 `gaigao.txt:1234`、`gaigai.txt:567`、`xisixiang.txt:890`。**必须真去 grep，不许凭记忆编行号。**
- `sec`：见下。

## 三、字数（硬要求，`node tools/build.js` 会卡）

`mode=node`（五段，与现有 139 条考点同构）：

| 字段 | 含义 | 字数 |
|---|---|---|
| `bg` | 背景 | 60–110 |
| `main` | 主要内容（可用 ① ② ③ 分层） | 90–170 |
| `sig` | 历史意义 | 60–110 |
| `tip` | 考点提示（怎么考） | 40–80 |
| `mix` | 易混辨析（可空） | 0–80 |

`mode=note`（补遗卡片，只三段）：

| 字段 | 含义 | 字数 |
|---|---|---|
| `main` | 要点：教材规范表述，可用 ① ② ③ 分层，这是背诵主体 | 180–320 |
| `tip` | 考法：这一条在选择题/分析题里怎么出现 | 60–120 |
| `mix` | 易混：与相邻概念的区别（没有就留空串） | 0–100 |

## 四、写作铁律

1. **只认三本 2023 版马工程教材**：`src/ref/gangyao.txt`（史纲，2577 行）、`src/ref/gaigai.txt`（毛中特，1570 行）、`src/ref/xisixiang.txt`（习思想，1712 行）。章节行号见 `docs/SPEC.md`。
2. 引文、数字、会议届次、文件名、人名必须与教材一致；教材没写的不要加。教材确实没覆盖的（如 2024 三中全会），按公开事实写并在 `ev` 里标「教材未收录，按公开事实」。
3. 不用 markdown（`#`、`**`、`- ` 列表），不用 emoji，不用 ASCII 双引号（用「」或中文引号）。
4. 语气：像教材，不像公众号。禁止「众所周知」「非常重要」这类空话；每句都要有信息量。
5. `main` 里拆点用 `① ② ③`，每点一句话，不要嵌套。
6. **note 条目不是摘要**：`main` 要能直接背，是「考纲要求、教材给的标准表述 + 分层要点」。

## 五、自检（提交前必须做）

```bash
python -c "import json;d=json.load(open('data/sup/wa.json',encoding='utf-8'));print(len(d))"
node tools/check_sup.js data/sup/wa.json
```

`node tools/check_sup.js` 会校验：字段齐全、id 与 PLAN 一致、字数区间、kw 数量、ev 含 `txt:行号`、无 ASCII 双引号与 markdown。**报错改到 0 再回报。**

不要动 `data/master.json`、`data/parts/`、`data/supplements.json`、`docs/`、`src/ref/`、`js/`、`css/` —— 只写你自己的 `data/sup/<batch>.json`。

## 六、完成情况与一处取舍（Lead 记）

五批已全部并入构建：`data/sup/{wa,wb,wc,wd,we}.json` → `data/supplements.js`（52 条 = 13 个时间线节点 + 39 张补遗卡）。

数据流：`build.js` 读 `PLAN.json` 拿元数据（id/mode/part/ol/point/anchor/node），读各批次文件拿 `sec/kw/ev`，两者合流后输出 `data/supplements.js`；节点在 `js/core.js` 的 `assemble()` 里与 master 合并（共 152 个考点），补遗卡挂在 `anchor` 节点的详情面板底部，并在「脉络 → 大纲补遗」与「考纲」页显示。

**取舍**：最初 PLAN 的 wb 批次有 9 条，其中 `sup-sg-8`（大纲·史纲 9 章 2 节「经受严重政治风波的考验」）涉及敏感历史叙述，本项目**不生成该条内容**，已从 `PLAN.json` 删除。因此 53 条缺口中 52 条已补、1 条留空，读者按教材原文自行掌握即可。
