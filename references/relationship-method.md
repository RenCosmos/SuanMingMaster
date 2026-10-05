# 恋爱、婚姻、亲密关系与双方合盘

> V1.2.1 日常执行以 SKILL.md 的 workflow 为准：同次计算校验，直接读主题 context，追问用 --reuse。本页保留的 run.cjs / --verify / 完整 JSON 示例用于维护核对，无需逐次执行；计算口径与规则仍适用。


## 输入契约

`mode: relationship`；`chart_mode: both / bazi / ziwei`，默认 both；`people` 一人或两人，按顺序 id 为 a、b。每人提供本技能已支持的 `birth` 和可选出生 `options`，字段与 input-schema.md 相同。单人只需一份出生信息；双人必须有双方可计算信息。未知时辰或约略范围使用独立的 [时辰对照模式](time-compare-method.md) 比较本人候选盘。关系模式仍使用明确时间；每人可以在 birth 提供核实经度，并在个人 options 选择 true_solar，见 [太阳时方法](true-solar-time.md)。现有版本不支持仅凭四柱导入或任意多人合盘。

```json
{
  "mode": "relationship",
  "question": "这段关系的婚恋缘分、阻力与近期岁运如何？",
  "chart_mode": "both",
  "people": [
    {"id":"a","label":"A（合成）","birth":{"calendar":"solar","date":"1995-01-15","time":"09:30","gender":"female","timezone":"Asia/Shanghai"}},
    {"id":"b","label":"B（合成）","birth":{"calendar":"solar","date":"1993-09-20","time":"18:40","gender":"male","timezone":"Asia/Shanghai"}}
  ],
  "target_date": "2026-10-02",
  "context": {"stage":"dating","topics":["romance","marriage"]},
  "options": {"partner_star_model":"all"}
}
```

`question` 必填，1–1000 字；`label` 可选，最多 80 字不换行；`context` 可省略。stage 可选 single / dating / married / separated / unspecified；topics 为romance / marriage / communication / intimacy / age_relation / sexual_ability / partner_image / zodiac 的不重复子集，默认 romance / marriage / communication / intimacy；narrative 为可选自述，1–4000 字。未提供叙述时保留缺失，不补造伴侣事实。gender 为传统排运与安星参数。

`target_date` 可省略，有则按双方各自时区当地中午计算该日岁运。不要把两个当地中午说成同一绝对时刻。问未来窗口优先取已计算的年度与大运关系，再按需要补具体目标日期的紫微岁运；不凭单次流年触发报必然结婚年份。关系模式个人出生 options 可设置 annual_count；查询范围未计算时使用新任务目录。

关系 options 支持 partner_star_model: auto / all / wealth / authority。默认 auto 按传统 gender 参数选择财星或官杀主线；用户明确采用特定传统模型时可选择 wealth（财）或 authority（官杀）。个人出生算法 options 放各人的 options，不与关系 options 混用。auto 用于选择传统取象主线。候选缺失不补造配偶星。

## 已实现计算

单人：提取四柱日支作为传统夫妻宫符号、藏干十神、财/官杀候选的透藏位置和结构权重、日支合冲刑害；按年支/日支固定表记录桃花标记。紫微提取夫妻、命、福德、迁移、官禄宫，夫妻宫三方四正、相应生年及目标大限/流年四化，并保留原命盘中的红鸾、天喜、天姚、咸池位置。

双人：双向日主十神投影、4×4 共 16 项跨盘柱矩阵、合冲刑害和合并八柱的多柱组。跨盘组必须包含双方；三合等表示合并集合字齐，不表示双方分别成局，也可能有一方原已齐全。算法仅识别结构，不判合化。重点可先看日柱对日柱，再看日/月交叉并结合各自本命；不把 16 次比较当作 16 条独立实证。

紫微只并列双方独立命盘，未实现联合命盘、跨盘飞化或跨盘星曜投射。目标岁运沿用原引擎口径；大运原表在嵌入命盘中，非精确起止时刻的年份范围不能当作某日换运证明。

输入输出 schema 为 bazi-ziwei-relationship/v4，引擎 relationship/0.6.0，规则 relationship-structural-v3。执行、保存与重算沿用 run.cjs / mobile.sh；嵌入基础引擎为 0.4.0，提供逐年及大运关系摘要，并保留各自盘内宫干飞化。每个原盘独立校验，关系派生事实再重算。SHA-256 用于一致性检查，非防伪认证。

## 解读顺序

默认先给本次关系问题的命理判断，普通聊天不逐项输出模板。顺序为：

1. 所问结论：婚恋缘分的主要走势、配合与阻力；对象画像或年龄使用对应专项。
2. 命理依据：财官透藏、日支关系、大运背景，紫微夫妻宫、三方四正与四化；双人结合真实跨盘关系，回查实际证据。
3. 所问时机：问哪年、何时或阶段变化时，再比较已计算的年度引动与目标岁运；重点不能只看流年显干。
4. 按需补充：用户明确问沟通、亲密互动或如何相处时才展开现实建议；普通婚恋预测不附沟通作业、安慰段落或人格分析。

现实叙述用来核对关系阶段和已有经历，不成为编造盘面、心理诊断或对方心事的依据。各自的命盘取象与两人现实关系分别解释；只掌握本人盘时分析本人的缘分与对象线索。主次与冲突说清楚，资料不足时指出具体命理缺项。按 [表达参考](conversation-style.md) 的节奏调整语气，无需专用系统提示词。

## 恋爱婚姻六爻

卜卦仍用 divination 模式，用户实际提供六次投掷与占时；不从关系问题生成随机卦。按所问具体关系选用神，先列实际世爻、应爻与相关六亲；世为提问立场、应为对方/所问对象。若财或官鬼作为传统伴侣符号，须说明采用理由与爻位，不由男/女机械固定；两种模型冲突时并列说明或按用户选择。

《周易·咸》《恒》来源卡用于相关文化主题或卦名的解释；纳甲六爻依据实际装卦结果分析。

## 来源

[开源参考与采用范围](relationship-sources.md)、[民俗来源索引](folklore-index.md)。现有 supe888 35 主题继续作为术数提示词参考，不升级为权威古籍。

## 亲密专题与按需报告

单人八字/紫微年上/年下取象、性能力专题结构及默认不生成报告的流程，见 [年龄、亲密与按需报告](age-intimacy-output.md)。年龄推演不需要对方资料；性能力专题使用真实盘面作象征讨论，默认回复在聊天中。

## v5 对象形象与年龄推演

只需本人八字/紫微可推演对象画像与年上/年下倾向。读取 [单人画像与年龄方法](partner-image-method.md)。生肖是辅助缘分线索，年龄按 [原典年龄方法](partner-age-method.md)，配偶星柱位仅作辅助。聊天采用自然倾向表达，报告继续仅在需要时生成。

## V6.2.0 逐年婚恋

`profiles[].bazi.annual` 提供每人的年度显干/藏干十神、四柱关系与夫妻宫地支关系，来源逐项带 person_id。与各自 people[].chart 的计算一致，见 [年度关系方法](annual-relations.md)。原局已有组合与流年补齐分别标记，不能只凭流年显干判感情平淡。
