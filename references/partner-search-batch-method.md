# 批量日期查询

只在跨月／全年筛选假设生日、逐月比较时读取本页。单次查询最多366个日期（可跨年），程序内部按公历月拆成不超过31天的原候选任务；原计算、未知时辰的全部结构采样、校验、缓存和详细结果均保留，不用模型自己写循环或安排12次工具调用。

## 先明确三个选择

- 范围：公历某年与立春年柱周期不是同一范围。“2011年兔”若指公历2011内属兔，则start/end为2011-01-01／2011-12-31，并显式candidate_year_branch="卯"。若指完整辛卯立春周期，要另明确跨年起止范围；本模块不自动把公历年换成春节年或补算下一年。地支scope按每个实际采样点的年柱筛选，立春当日不会整天误分。
- 条件：filters.match默认any，保留用户原条件。ranking只选展示的最高命中档，不改计算或筛选。只有用户明确要求所选条件全部成立，才用match=all。
- 时辰：未知用time_uncertainty.type=unknown，不能为了省token改成任意单个时刻。候选时刻都是假设，不是已知现实生日；时辰不同的刑冲不能用首个时刻代替。

| ranking | 含义 |
| --- | --- |
| monthly_top（默认） | 每月各自命中数量最高的日期；某月最高只有3项仍返回，不说该月“没有” |
| global_top | 全任务范围的最高命中档，按月列出；空月只表示未达全年最高档 |
| all | 所有符合原条件且在显式年支scope内的日期，必要时按月／日期分页 |

命中数量可能重复表达相关结构，不是概率、独立证据数量或综合合婚分数。不能写“满分，所以没有比这更合”，也不按刑冲类别数量创造轻重分。日期有多个日柱／时辰变体时保留差异，不压成一个真实时柱。

## 预算调用与自动续跑

workspace_shell timeout=60秒。程序默认20秒计算预算，按天检查并保存独立核验的扫描进度，不等全年完成才返回；这是软预算，还需完成当前日及保存投影。新任务只提交一次输入，execution.state=yielded时优先照next_actions的--resume argv续跑，不自己拆月。完整任务才ok/validation.ok=true；待续跑partial=true不是失败，state=failed才根据error排障。20KiB是每次响应预算，不能拼接多份JSON或接tr/grep/head，也不隐藏stderr。

可选--time-budget 1..60（秒）和--max-days 1..366仅控制本次执行量，不改筛选范围、时辰采样或排序规则。默认不加。总任务时间仍随范围与手机性能变化，不承诺全年固定秒数。

    sh /skills/bazi-ziwei/scripts/mobile.sh --agent --stdin --partner-search --batch --out /workspace/bazi-ziwei-reports/BATCH-TASK <<'SM_INPUT'
    {"mode":"partner_search_batch","self":{"birth":{"calendar":"solar","date":"1996-06-15","time":"12:00","gender":"male","timezone":"Asia/Shanghai"}},"as_of":"2026-10-08","search":{"type":"dates","start":"1997-01-01","end":"1997-12-31","timezone":"Asia/Shanghai","time_uncertainty":{"type":"unknown"}},"candidate_year_branch":"丑","ranking":"monthly_top","filters":{"match":"any","year_gap":[-12,12]}}
    SM_INPUT

这是合成示例，替换为本次资料及客户端as_of；新任务必须--out，不使用旧--focus。已有明确普通chart可加--source-chart原路径并从JSON省略self；双人原盘明确--source-person a/b。不猜最新原盘，不改源文件。临时输入紧跟模式入口：--agent --temp-input FILE --partner-search --batch --out TASK，自动清理；stdin不另落输入文件。

## 只按摘要回答，按需展开

files.chart指向批量batch.json（不是旧单盘chart），月份完整结果在同目录months/YYYY-MM/chart.json。computed_complete表示所有月份计算且核验完成；ranking_final=false时全年最高只能作为已完成范围的临时值，先续跑，不得提前输出全年结论。summary_page_complete只表示当前请求页没有后续月份／日期页。月份status=not_completed表示未算完或未核验完，不能回答成“无”；coverage.unavailable>0说明存在不可算点。当天完整采样和独立复算的断点在scan-checkpoint.json，不作为命盘解释，也不cat进上下文。

months内date_page.total是本档日期数；matching_samples／best_samples是采样点数，不是人数、概率或日期数。max_matched／conditions_at_best表示已计算点上的条件命中档。sample_shared_risk_types仅指命中采样点共同的关系；sample_conditional_risk_types包含随时辰、边界或其他变体变化的关系。二者可以包含相同类别但不同关系，不能因此把整个日期判为无刑／固定有刑或断现实婚姻。

默认一次尽量返回所有月份和每月最多5个日期；更多结果的next_actions给出完整argv。sources与本人柱摘要只在首个总览页返回，后页用source_ids，勿为恢复公共文字读完整chart。选定日期才执行该日期details.argv，返回对应采样时辰分页及原全部关系；下一页继续用返回的argv。argv是mobile.sh完整参数，逐项安全引用，不eval，不自己拼offset。

批量--reuse TASK/batch.json支持--rank monthly_top/global_top/all，不重算或改变原filters；--month YYYY-MM翻该月日期，--date YYYY-MM-DD展开时辰，--offset/--limit针对当前页。不要把--limit误认为不能控制；日期详情最多10项，预算可自动减小，不能由此认定其余证据不存在。

## 恢复与边界

批量月份成功后逐个保存，ok=false／partial=true时只报告未完成月份和错误，不据不完整结果宣布全年结论。排除本次错误或超时后使用返回的--reuse batch.json --resume argv；可信已完成月份不重算，不删锁、不覆盖新人物。不同范围／本人／条件新建目录；仅改展示ranking可明确reuse --rank。

所有摘要与详情继续限制stdout≤20KiB、完整shell包装<28KiB，检查最终临时清理字段后再输出。没有减少原知识、采样、完整命盘或来源；只减少重复进入模型上下文的展示。validation.ok证明计算与缓存一致，不证明现实正缘身份、取向、能力或医学事实；不称候选时刻为现实生日。需要报告仍可对某个月的原chart使用旧--partner-search --report；原years/dates/people入口均保留。

正式集成需要时才读[批量输入schema](partner-search-batch-input.schema.json)和[批量输出schema](partner-search-batch-output.schema.json)，不用为了正常调用加载两份schema。[两个月合成JSON](../examples/partner-search/batch.json)供调试，普通用户按本页一次调用即可。

candidate_pillars按年月日时提供理论四柱；验证干支、五虎遁和五鼠遁后，只展示原完整采样中四柱逐项相等的点。与ANY/ALL共同生效，不减少采样或修改月份chart；约束进入scope及输入键，改目标须新目录。空结果只表示已算点未命中，采样不是逐分钟穷举。批量引擎1.0.1区分精确约束，1.0.0无此约束的任务仍可核验复用；这不是产品版本号。见[条件规划](partner-search-plan-method.md)。
