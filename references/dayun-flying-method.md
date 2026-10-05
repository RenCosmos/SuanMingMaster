# V1.1.1 大运与宫干四化

> V1.2.0 日常执行以 SKILL.md 的 workflow 为准：同次计算校验，直接读主题 context，追问用 --reuse。本页保留的 run.cjs / --verify / 完整 JSON 示例用于维护核对，无需逐次执行；计算口径与规则仍适用。


基础引擎 0.4.0，关系 relationship/0.6.0，时辰对照 time-compare/0.5.0。大运及飞化功能在 V1.1.1 加入，当前产品包为 1.1.4；V1.1.2 仅更新输入生命周期，原 0.4.0 JSON 仍可校验。更早计算版本的 JSON 需以原始输入重新生成。

## 八字大运

`bazi.chart.dayun[]` 新增 stem、branch、hidden_stems、hidden_ten_gods、pillar_relations、day_branch_relations。显干和每个藏干的十神均相对本命日干。关系与年度表共用 periodRelations；每条记录包含所属 `BZ-DY-n`，编号为 `BZ-DY-n-REL-NNN`。

| 字段 | 阅读方式 |
| --- | --- |
| pillar_relations | 本步大运参与的天干五合和地支合冲刑害破、三合三会等 |
| day_branch_relations | 地支记录中实际涉及 BZ-DAY 的关系 |
| natal_group_present / group_state | 原局已有组合，或加入本步大运后才齐全 |
| natal_relation_ids | 回查原局实际关系记录 |

关系模式在 `profiles[].bazi.dayun` 提供同样事实，来源带 person_id，可回查 `people[].chart`。报告按显干/藏干、大运与夫妻宫和四柱关系显示。公历年标签与名义年龄是库的展示口径；准确起运时刻仍在 qiyun。本版分别计算大运对原局、流年对原局，尚无完整运岁联合矩阵或自动喜忌裁定。

## 紫微宫干四化

`ziwei.calculations.palace_stem_flying` 包含 transformation_table、entries、self_transforms、palace_summary。每宫按自身宫干发出禄权科忌四条，共 48 条；调用 iztro 2.6.1 当前配置的四化表，在同一盘真实主星、辅星与杂曜中定位目标。四化星缺失或位置不唯一时计算失败。

| 字段 | 含义 |
| --- | --- |
| id | `ZW-FLY-宫索引-禄/权/科/忌` |
| origin_palace_id / origin_palace / origin_heavenly_stem | 发出宫的编号、名称及宫干 |
| target_palace_id / target_palace | 实际星曜落入宫 |
| star / mutagen | 本次四化星与化别 |
| is_self_transform | 发出宫与目标宫相同 |
| source_ids | 去重后的两端实际宫位编号 |
| palace_summary | 按宫列发出、落入、自化的记录编号 |

生年四化、盘内宫干四化、大限及流年四化分别阅读。重复宫干保留各自发出记录；本宫自化同时保留发出与落入身份。这里没有把“发出宫”命名为全派“来因宫”，也不赋飞化吉凶分数。

关系模式的 `profiles[].ziwei.palace_stem_flying` 保留命、夫妻、福德、迁移、官禄任一端参与的记录，并标记人物来源。单人和双人均是各自盘内四化，没有跨盘安星或跨盘飞化。

## 时辰对照

摘要在原有 stable / varies 框架增补：

- `TC-BZ-ANNUAL-YYYY`：逐年的干支、显干/藏干十神与日支关系。每年分别比较；关系的组合状态和参与柱计入比较。
- `TC-ZW-SPOUSE-FLY`：夫妻宫参与的盘内飞化，比较发出宫、落入宫、四化星及自化身份。

来源回查完整候选的实际记录。摘要一致表示本次成功候选的这些字段相同，不代表所有人生判断都已确定。大运完整关系仍在候选原盘和关系画像，深入时提取相关候选读取。

V1.1.4 年龄派生规则修订使旧关系/时辰对照 JSON 需要重算；基础八字/紫微 0.4.0 JSON 的校验契约保留。年龄计算见 [单人年龄方法](partner-age-method.md)。
