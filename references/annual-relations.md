# 逐年流年关系 · V1.1.1

> V1.2.0 日常执行以 SKILL.md 的 workflow 为准：同次计算校验，直接读主题 context，追问用 --reuse。本页保留的 run.cjs / --verify / 完整 JSON 示例用于维护核对，无需逐次执行；计算口径与规则仍适用。


`bazi.chart.annual` 保留原有年度编号、立春周期、干支与显干十神，补充流年地支及藏干十神、流年与四柱的关系、日支关系筛选。基本排盘、关系模式和时辰对照候选都提供这些事实。输入契约沿用 [出生输入](input-schema.md)：提供 `target_date`，`annual_count` 默认 5，可设 1–20；无目标日期时 annual 仍为空。

## 字段与来源

| 字段 | 含义 |
| --- | --- |
| stem / branch | 流年天干、地支 |
| hidden_stems / hidden_ten_gods | 流年支藏干及相对本命日干的十神；按相同数组顺序对应 |
| pillar_relations | 只返回本流年柱参与的关系；含天干五合及地支六合、冲、刑、害、破、三合、三会、自刑 |
| day_branch_relations | 上一字段中 `relation_field=branch` 且含 BZ-DAY 的记录，即涉及本命日支/夫妻宫的流年关系 |
| relation_field / touches_day_branch | 区分天干和地支；天干与日干五合不会误标成日支关系 |
| natal_group_present | 三合、三会、三刑齐全、自刑等组合，在加入本流年柱之前是否已被原局识别 |
| group_state | natal_already_complete：原局已有，流年再次参与；completed_with_period：加入本流年后才齐全 |
| natal_relation_ids | 原局已有组合对应的 BZ-REL-xxx；加入流年后才齐全时为空 |

年度关系编号为 `BZ-ANNUAL-YYYY-REL-NNN`；每条 `pillars` 都包含所属年度编号与实际涉及的本命柱位。三字组合保留全部参与柱，包括同一支出现在年柱与流年中的情况；重复支不能顶替缺失的第三个支。

`target.year_relations` 与逐年表复用同一计算函数，保留原有 BZ-TARGET-REL 编号，并带相同的关系与组合状态字段。相同立春周期的结果只在流年来源编号上有差别。组合沿用本包已选关系表，配对刑与三刑齐全可并存；不新增半合、拱局或成化裁定。

关系模式在 `profiles[].bazi.annual` 同步逐年表；每项 `source`、关系 `source` 与柱位 `sources` 带 `person_id`，可回查各自 `people[].chart`。时辰对照候选的关系盘保留各自逐年表；V1.1.1 摘要新增 TC-BZ-ANNUAL-YYYY，逐年比较干支、显干/藏干十神和日支关系。全体四柱关系仍可按需提取完整候选读取。

## 已验证的合成命例

以下使用专门构造的合成出生输入，不取自用户反馈。样例四柱为甲戌 / 丙寅 / 庚午 / 辛巳。从 2029 年立春周期开始，2030 年项目会返回：

```json
{
  "id": "BZ-ANNUAL-2030",
  "ganzhi": "庚戌",
  "stem_ten_god": "比肩",
  "day_branch_relations": [
    {
      "id": "BZ-ANNUAL-2030-REL-001",
      "type": "三合",
      "symbols": "寅午戌",
      "pillars": ["BZ-YEAR", "BZ-MONTH", "BZ-DAY", "BZ-ANNUAL-2030"],
      "relation_field": "branch",
      "touches_day_branch": true,
      "natal_group_present": true,
      "natal_relation_ids": ["BZ-REL-004"],
      "group_state": "natal_already_complete"
    }
  ]
}
```

这是完整记录的字段节选。合成原局年戌、月寅、日午已经三字齐全；2030 年戌再次参与，不称为该年才首次形成三合。寅午戌的火局分类可核 [《三命通会·卷二》论支元三合](https://zh.wikisource.org/wiki/三命通會/卷二)，本程序这里只标结构命中，成化与具体感情结果另依本盘综合解释。

可用 [合成输入样例](../examples/annual-relations-input.json) 重新计算并校验；安装包不预存示例结果，日常运行默认仅生成计算 JSON。

## 逐年解读

逐年看感情时，把显干十神、藏干财官、日支关系和原局、大运放在一起读。先指出该年的关键结构，再解释有利、拉扯或并存的线索。非财星显干不能单独推出“感情平淡”；也不能把有合或有冲直接改写为恋爱成功、结婚或分手。

没有 day_branch_relations 命中表示本规则表没有命中该年与日支的关系，不表示没有感情事件。旧版本缺少此字段则是数据不完整，应使用原始输入复算为 V1.1.1，不当作“无关系”。事业、身体状态等主题同样可以取用全体四柱关系，结合所问与其他实际证据解释。

不确定出生时间时，对照各候选的年度列表。只保留实际共同关系作为稳定判断，时支或日界导致的组合变化单列说明，不从多数候选选出一个“正确”时辰。

## 版本与核验

年度关系自 V6.2.0 加入，V1.1.1 延续该功能并补充大运关系、宫干飞化和候选年度摘要。当前包版本 1.1.4，基础引擎 0.4.0、关系 relationship/0.6.0、时辰对照 time-compare/0.5.0，六爻 liuyao/0.1.0。V1.1.2 只更新输入生命周期，V1.1.1 的 0.4.0 JSON 仍可直接校验；schema 名称和知识内容保留。知识主题为 66。

10 项专项验证使用合成命例及人工指定地支结构，涵盖十二年与独立目标入口一致、合冲刑害并存、三字补齐及原局已有状态、重复支、立春周期、双人来源、时辰候选、篡改后重算与按需报告展示。

V1.1.4 年龄派生规则修订使旧关系/时辰对照 JSON 需要重算；基础八字/紫微 0.4.0 JSON 的校验契约保留。年龄计算见 [单人年龄方法](partner-age-method.md)。
