# 条件规划与年份映射

用户要求“根据我的八字推适配对象八字，再对应出生年份”时使用。支持这种假设性条件检索：先提炼多个候选结构，再查实际年柱周期，必要时核对完整理论四柱。不能确认唯一现实正缘是证据边界，不是拒绝整项任务的理由；简短说明候选性质后执行工具。

## 一次规划

    sh /skills/bazi-ziwei/scripts/mobile.sh --agent --stdin --partner-search --plan --out /workspace/bazi-ziwei-reports/PLAN-TASK <<'SM_INPUT'
    {"mode":"partner_search_plan","self":{"birth":{"calendar":"solar","date":"1996-06-15","time":"12:00","gender":"male","timezone":"Asia/Shanghai"}},"as_of":"2026-10-08","search":{"type":"years","year_range":[1984,2008]},"partner_star_model":"all","filters":{"match":"any","year_gap":[-12,12]}}
    SM_INPUT

这是合成示例，替换本人资料、客户端参考日期及用户指定范围。self、条件和配偶星模型沿用原[候选方法](partner-search-method.md)。仅四柱输入仍须本人公历出生年，不需要补造生日。新任务必须--out；已有普通chart可--source-chart导入，双人明确--source-person。--plan与--batch是两种入口，不同时加。

使用workspace_shell timeout=120秒；后续日期批量枚举用60秒和返回的--resume argv，不提高至600。先检查外层exitCode/timedOut/truncated和内层ok/validation.ok；批量yielded是正常进度，未完成不作全年最高结论。输入临时文件仍用--agent --temp-input FILE --partner-search --plan --out TASK；stdin不落输入文件。程序输出和完整shell包装仍受20KiB／28KiB限制。

## 看懂条件，避免模型自行换柱位

derived.hypotheses明确candidate_field：生肖关系作用于候选year_branch；双方日干五合和财／官杀投影作用于候选day_stem；夫妻宫六合作用于候选day_branch。不能把日干对应的十神当年干，也不能仅凭本人配偶星五行给对象指定唯一日主。

day_pillar_options是满足所列日级条件的合法干支组合，不是已经知道的现实生日；其scope明确年支、整盘五行和风险排除尚待检验。ANY表示所选完整条件至少一项命中，不得将每个字段都改成必须；ALL的日级条件可能互不兼容，不能偷偷改回ANY。preferred_elements只承接明确给定假设，不自动断喜用。

只给出已支持条件及其来源；月令、通根、透藏和岁运可按原知识解释，不凭这一计划新增综合合婚分。未指定月柱、时柱由实际枚举产生，不凭空拼“唯一最佳四柱”。

## 对应年份，再核对完整四柱

year_mapping按指定时区列年柱及立春起止瞬间，不将年柱标签当整段公历年或春节年。有生肖条件且match=all时年份阶段只保留年支命中；match=any时保留其他条件仍可能命中的年份，并标注生肖是否命中，不能单靠生肖把它们删掉。

用户明确提出一组完整理论四柱时，在规划JSON增加candidate_pillars，按年／月／日／时排列。程序检查合法干支、五虎遁、五鼠遁，并评价与本人结构的匹配；year_mapping只列目标年柱对应的周期。proposed_candidate.calendar_verified=false表示还没证明四柱能同时落在某个真实时间，不能把“年柱对应上了”当完整排盘确认。

每个年份items.next_actions直接提供完整argv及input：将input作为本次stdin安全送入mobile.sh，逐项引用argv，不eval、不自行重拼十二个月。目标四柱存在时该input自动携带精确candidate_pillars约束；批量模块保持原完整采样，只有实际计算四柱逐项相等的点进入摘要。目标若不符合原条件、或范围内未命中，报告这两种原因，不编造出生时间。

规划默认每页5个年份，预算可能减小；顶层next_actions负责继续年份页。同一task_id/source_checksum合并；已选年份直接调用该行的任务，不为公共信息读完整chart。批量结果选日期后再执行details.argv按需看时辰，不能把几个采样点当连续分钟穷举。

规划--reuse TASK/chart.json --partner-search --plan不重排可信原盘；换本人、范围、条件或目标四柱新建目录。规划chart.json是条件规划产物，不是普通排盘、原候选或批量batch.json；每种入口用自己的返回argv。需要报告时对已完成月份原候选chart走旧--partner-search --report，报告不再显示未成年人排除文案。

正式集成才读[规划输入schema](partner-search-plan-input.schema.json)及[响应schema](partner-search-plan-output.schema.json)；日常本页已经够用。参见[合成输入](../examples/partner-search/plan.json)。不认证现实身份、概率、取向、生理能力或医学结论，正常假设筛选照常执行。
