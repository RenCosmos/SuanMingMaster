# 逐年流年关系

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

关系模式在 `profiles[].bazi.annual` 同步逐年表；每项 `source`、关系 `source` 与柱位 `sources` 带 `person_id`，可回查各自 `people[].chart`。时辰对照候选保留逐年表，TC-BZ-ANNUAL-YYYY比较干支、显干/藏干十神和日支关系；完整候选中的全体四柱关系按需读取。

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

没有day_branch_relations命中仅表示本规则表未命中，不表示没有感情事件。旧产物缺少字段时，用workflow核验或按原始输入在新目录补算，不能当作“无关系”。其他主题同样结合全体四柱关系与所问证据解释。

不确定出生时间时，对照各候选的年度列表。只保留实际共同关系作为稳定判断，时支或日界导致的组合变化单列说明，不从多数候选选出一个“正确”时辰。

## 查核

专项测试覆盖年度与独立目标入口一致、合冲刑害、组合状态、重复支、立春周期、双人来源、时辰候选及篡改检测。年度页中的大运按实际交运区间读取，详见[大运方法](dayun-flying-method.md)；产品版本与专项结果不在本方法中混写。
