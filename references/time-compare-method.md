# 出生时辰不确定：候选盘对照

> V1.2.0 日常执行以 SKILL.md 的 workflow 为准：同次计算校验，直接读主题 context，追问用 --reuse。本页保留的 run.cjs / --verify / 完整 JSON 示例用于维护核对，无需逐次执行；计算口径与规则仍适用。


用户记不清几点出生、只记得一个时间范围，或有几个不同说法时使用 `mode: time_compare`。先核对日期、公/农历、gender、出生地时区及农历闰月；保留时间的不确定程度。完全不知道时间也能开始对照。

## 输入

这是单人出生时间比较，`birth` 不填 time；各候选由程序独立排八字、紫微及单人关系盘。`chart_mode` 默认 both，也支持 bazi / ziwei。匿名 label、question、target_date 可选；question 默认比较时辰的一致项与变化项。出生口径放 `birth_options`，与 [出生输入契约](input-schema.md) 的 options 相同；配偶星模型放关系 `options`，context 沿用 [关系方法](relationship-method.md)。

```json
{
  "mode": "time_compare",
  "label": "时辰不确定（合成）",
  "question": "比较不同出生时辰对婚恋、对象画像和年上年下判断的影响",
  "chart_mode": "both",
  "birth": {"calendar":"solar","date":"1995-01-15","gender":"female","timezone":"Asia/Shanghai"},
  "time_uncertainty": {"type":"range","start":"08:30","end":"10:30"},
  "context": {"stage":"single","topics":["romance","marriage","partner_image","age_relation","zodiac"]},
  "options": {"partner_star_model":"auto"}
}
```

| 记忆情况 | time_uncertainty |
| --- | --- |
| 当天完全不记得时间 | `{"type":"unknown"}` |
| 记得上午 8:30–10:30 | `{"type":"range","start":"08:30","end":"10:30"}` |
| 不确定是辰时还是巳时 | `{"type":"range","start":"07:00:00","end":"10:59:59"}` |
| 两个明确时间的记录 | `{"type":"candidates","times":["08:30","09:30"]}` |
| 明确说是当晚 22:30 到次日 00:30 | `{"type":"range","start":"22:30","end":"00:30","end_day_offset":1}` |

时间为 HH:mm 或 HH:mm:ss。范围两端均包含，明确跨午夜才加 end_day_offset:1；次日按公历实际日期转换，农历不能直接加日期字符串。指定候选可填 1–48 个不重复时间，属于同一个已知出生日期。只有一个候选时状态为 single_candidate，不称作跨时辰一致。

“大概早上”“天刚亮”先自然确认能记得的范围；无法进一步确定时用 unknown。“子时”涉及两个钟表日期，先核对日期和早子/晚子说法。保留用户给出的范围，不私自缩窄，也不补一个默认出生时间。

## 程序比较方法

unknown 覆盖所填出生日期 00:00:00–23:59:59。普通一天分为 13 段：早子 00:00–00:59、丑 01:00–02:59，依次至亥 21:00–22:59，再单列晚子 23:00–23:59。早子与晚子分别安盘，保留两套引擎的换日配置。

范围在时辰边界、日历午夜、节气秒级瞬间、时区跳时或重复区间处分段。节气表的北京时间先转换为出生地钟表时间。每段取首秒、中间秒、末秒逐一计算，重复点去重；普通全天为 39 个候选点。范围正好止于新时辰的边界时，末端新时辰也会计算。最多 256 个候选点。

true_solar 时仍输入原始钟表范围，经度放 birth，time_basis 放 birth_options。程序额外把校正后的太阳日期/时辰边界反算成钟表秒，与钟表边界一起分段；候选数可超过 39。候选记录保留 true_solar_datetime、bazi_day_hour_datetime 和边界复核信息，详见 [太阳时方法](true-solar-time.md)。

每个候选嵌入完整的 relationship/v4 计算产物，使用相同出生参数、配偶星模型及目标日期。一致项按已成功计算的候选点归组；精确起运时刻逐点保存，不把连续分钟中的起运值说成恒定。候选数量表示比较覆盖，不用作出生概率，不自动选最符合经历的时辰。

夏令时造成不存在或重复的钟表时间时，该候选保留 unavailable 与具体错误，其余候选仍比较。回复点明哪段时间需要核实 UTC 偏移；“一致”只描述已算成功的候选。用户核实了偏移或缩小了范围，再以新输入重新计算。

## 执行、校验与读取

手机命令沿用 SKILL.md 的独立任务目录与输入写入流程：

```sh
sh /skills/bazi-ziwei/scripts/mobile.sh --temp-input /workspace/bazi-ziwei-reports/TASK/input.json --out /workspace/bazi-ziwei-reports/TASK/result
sh /skills/bazi-ziwei/scripts/mobile.sh --verify /workspace/bazi-ziwei-reports/TASK/result/chart.json
```

默认生成两个计算文件：chart.json 为完整候选及对照；comparison.json 为去掉嵌入命盘的摘要。校验须 ok=true、recalculated=true、summary_verified=true。摘要必须与本次完整数据对应；CLI 会重算每个候选、比较汇总及摘要。也可直接 `--verify .../comparison.json`，同目录需保留 chart.json。

校验后优先读取 comparison.json：

- input、coverage、intervals、candidates：本次范围、分段与可计算状态；候选的 time_boundary_review 保存太阳钟面及节气临界复核信息，命中时回查具体候选。
- comparison.fields：四柱、日主、五行本字计数、大运顺逆和干支顺序、对象年龄主线；紫微命身宫、五行局及命/夫妻/福德/迁移/官禄宫主星；生肖口径与辅助缘分。
- fields.status 为 stable / varies / single_candidate；variants 中 value 与 candidate_ids 对应每个分支。
- comparison.image_tags：外形、气质、风格的 common 与 varying 标签。
- qiyun_sampled_start_times：候选点的精确起运值。

同一项目的一致不自动代表所有婚恋判断一致。涉及画像标签、辅助星曜、四化、岁运或未列入摘要的细节时，回查相关完整候选。为减少手机端读取体积，可提取某个真实候选后用原关系方法读取：

```sh
sh /skills/bazi-ziwei/scripts/mobile.sh --extract /workspace/bazi-ziwei-reports/TASK/result/chart.json --candidate TC-001 --out /workspace/bazi-ziwei-reports/TASK/candidate-TC-001
```

提取只保存该候选原有 chart.json，保留原始输入和校验和。它仍是对照用的候选，不能作为已确定时辰继续谈全部未来。几个分支需要深入时分别提取，不把整包几十张盘贴到对话里。

完整数据 schema 为 bazi-ziwei-time-compare/v1，摘要为 bazi-ziwei-time-summary/v1，引擎 time-compare/0.5.0。默认不会生成报告；用户需要文件时对完整 chart.json 执行 --render，或首次显式加 --report。reading.md 同样只在要求保存解读时写。

各候选关系盘保留逐年四柱/夫妻宫关系，见 [年度关系方法](annual-relations.md)。V1.1.1 的 comparison.json 新增 TC-BZ-ANNUAL-YYYY 与 TC-ZW-SPOUSE-FLY，比较逐年日支关系及夫妻宫参与的宫干四化。完整四柱和大运关系可按需提取候选读取，详见 [大运与飞化方法](dayun-flying-method.md)。

## 自然解读

先回答当前关心的主题：在候选中保持一致的内容可以先说清，再解释随时间变动的分支。适合比较时用两三列表格，列“共同部分 / 变化部分 / 对当前问题的影响”。无需把所有时辰平均展开。

例如年上/年下在候选中变化时，说明对应范围各自的年龄主规则及八字柱位旁证，保留分歧；对象画像取 common 标签作为共同轮廓，varying 标签按候选分支说明。只有实际结果支持时才说某项一致；不要套“八字日柱总是不变”或“紫微一定全部变化”。

语气按 [对话语气说明](conversation-style.md)。用户只说时间不清楚时可以自然接住：“没关系，记得大概范围也可以，我们先比较哪些地方一样、哪些需要分开看。”不要因缺时分拒绝整个任务，也不要求用户先猜一个时间。

后续得到出生证明、家人记忆等新记录时，缩小输入范围再算。经历可以帮助提问与理解分歧，不能据此把程序未确定的出生时辰认定为事实。

V1.1.2 默认改用 --stdin 的带引号 here-document，不创建 input.json。上面的文件入口仅在需要文件传递时使用，并在结束后自动清理；详见 [输入生命周期](input-lifecycle.md)。

V1.1.4 的 TC-AGE 比较主方向、依据类型与状态；TC-AGE-ZW-RULES 比较实际主星/辅星规则；TC-AGE-MODELS 只比较八字柱位辅助取象。仅紫微模式也包含年龄字段。候选均为 none 表示均无明确主方向，不能写成同龄结论。
