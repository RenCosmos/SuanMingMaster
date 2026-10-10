# 大运与宫干四化

基础引擎0.4.0、关系relationship/0.6.0、时辰对照time-compare/0.5.0为独立计算身份；旧产物统一由workflow核验，不按文档里的历史产品号判断有效性。

## 八字大运

`bazi.chart.dayun[]` 新增 stem、branch、hidden_stems、hidden_ten_gods、pillar_relations、day_branch_relations。显干和每个藏干的十神均相对本命日干。关系与年度表共用 periodRelations；每条记录包含所属 `BZ-DY-n`，编号为 `BZ-DY-n-REL-NNN`。

| 字段 | 阅读方式 |
| --- | --- |
| pillar_relations | 本步大运参与的天干五合和地支合冲刑害破、三合三会等 |
| day_branch_relations | 地支记录中实际涉及 BZ-DAY 的关系 |
| natal_group_present / group_state | 原局已有组合，或加入本步大运后才齐全 |
| natal_relation_ids | 回查原局实际关系记录 |

关系模式在 `profiles[].bazi.dayun` 提供同样事实，来源带person_id，可回查`people[].chart`。当前运按dayun_at_target及qiyun.start_datetime_beijing锚定的精确区间读取；start_year/end_year和名义年龄仅为展示标签，不能当作1月1日交运。target_date以输入时区正午判断，交运日附近区分前后；详见[岁运口径](romance-method.md)。大运与流年分别对原局计算，尚无完整运岁联合矩阵或自动喜忌裁定。

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

旧产物按workflow实际校验状态复用或重算；年龄字段见[单人年龄方法](partner-age-method.md)。
