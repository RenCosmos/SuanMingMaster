# 分层十神与稳定柱交叉证据

按问题选下面一个入口，不为“完整”全部执行。双方时辰已知且还没排盘，仍优先一次relationship双人输入，再用原comparison分页；不要改成两次单盘。

## 原局／当前大运归属

已有本命但要核对“当前运究竟带哪种十神”时：

```sh
sh /skills/bazi-ziwei/scripts/mobile.sh --reuse CHART --page ten-gods --base-checksum SHA
```

SHA替换成基础context.source_checksum；双人relationship另加--person a或b。支持普通八字、关系盘和time_compare，不支持纯紫微或六爻。不加--offset、--years、--flying-offset，也不重排。返回view=evidence_page、view_schema=suanming-ten-god-evidence/v1、reading.ten_god_evidence：

- natal.scope=natal，仅为原局；known_pillars与uncertain_pillars分已知／稳定柱和变化柱。
- current_dayun.scope=current_dayun，按目标日的精确交运瞬间选运；variants各列本步运自身的visible和hidden，以及交运瞬间范围，不把原局十神移入。
- visible.field=stem；hidden.field=hidden_stems且index对应原藏干下标。藏干有某星不叫“透出”。年度情感增量页同理分partner_stars_visible与partner_stars_hidden，旧partner_stars仅兼容混合摘要。
- 时辰对照按已计算候选归组；仅一个可算候选时status=single_candidate，不称多点稳定；coverage.unavailable_count列未算点。目标日未给／未交首运／已超所算运段，读取variant.status，不补猜当前运。日主变化时十神不强选一个。

与同source_checksum的基础context合用；非每次情感对话都要额外读。完整原命盘、旧主题与报告不变。

## 一方／双方时辰未知的双人问题

先复用已有资料：已知时辰者用现有单人chart.json；未知者依[时辰契约](time-compare-method.md)生成time_compare的chart.json。两个来源的target_date应一致，不选默认午时、不重新循环几十张盘，也不直接把两段单盘解读称为合盘。然后执行：

```sh
sh /skills/bazi-ziwei/scripts/mobile.sh --reuse /workspace/bazi-ziwei-reports/A/chart.json --pair-with /workspace/bazi-ziwei-reports/B/chart.json --out /workspace/bazi-ziwei-reports/PAIR
```

来源必须各为单人且含八字：普通bazi/both、单人relationship、time_compare。已有双人盘用原--comparison，不用此桥接。输出目录独立于双方来源，不修改任一来源的chart/context/validation；新范围、来源顺序或程序变化另建任务。

context.schema_version=suanming-pair-evidence/v1，full_pair=false。它确实调用原固定关系表，返回双向日主投射、稳定柱之间的pillar_matrix和cross_relations；不是完整八字或紫微联合盘。sources保存各方checksum、task_id、coverage和口径，来源a/b由命令先后确定。只有在各自已计算候选范围都相同的柱才入矩阵，变化时柱不会夹带；日主变化时相应投射为null。

默认每列表最多10项，超过容量自动缩页，避免人为拆得过碎；按next_actions.argv继续，不重拼。共同游标pair_evidence.next_offset按两份列表较长者推进，较短列表读完为空不代表没有关系。合并相同pair_key的页；page_is_last只代表到末页，previous_pages_required提示还需前页；complete_for_stable_pillars只在从0且本响应包含全部稳定柱证据时为true。

pair_evidence.missing标出变化柱；not_computed标出时辰相关交叉和紫微对照未算。结论只覆盖稳定部分，不将缺失说成“无关系”；需要随时辰变化的证据时再按用户资料缩小时辰范围，不挑一个候选冒充确定出生时辰。两人当前运的归属问题分别用上面的分层页，不把一方原局或大运安到另一方。

## 容易混读的标记

- 初次情感页与年度续页都列partner_stars_visible／partner_stars_hidden；expression_sources.kind区分食伤显干与藏干。现代年龄的日支本气线索也明确kind=hidden_stem，不因命中年龄线索就称透干。
- 日干自身is_day_master_self=true，只是本人日主的自参照，不当作另有一个比肩；原十神权重、原局和大运的分层不改。
- --comparison专页及桥接页的cross_relation_context是原关系记录的旁注，不替换原记录；默认合盘摘要不重复整段旁注，需要判断合局来源时读取交叉专页。relation_id指向同页交叉关系；natal_complete_people为a／b时表示该方原局已齐，空列表且group_state=completed_across_people才表示双方合看才齐。三合、三会、三刑齐全和本规则表自刑均区分，不等于合化或事件成立。
- 桥接的reference_frames明确a_to_b是以a日主看b，b_to_a反之；矩阵每项关系用独立ID，不与原局或另一格混引。双方四柱已知时不会再误报“时辰相关交叉未算”；紫微对照仍未计算。

记住双方files.chart和返回的pair_key／files.context；本入口保存pair-context.json与pair-validation.json，后者绑定当前程序指纹和双方文件摘要，供后续页安全复用，不是普通--reuse命盘。不cat大文件。普通timeout=120秒；旧／外部结果缺可信回执时先各核验一次，后续页复用同一证据回执。仍遵守20KiB stdout和28KiB完整包装上限，不能容纳时明确报错，不截断JSON。
