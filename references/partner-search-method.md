# 正缘候选筛选

全年／跨月优先[批量日期查询](partner-search-batch-method.md)，按预算续跑、按日期汇总。以下为单任务契约，日期上限31天；不能为缩短输出将any改all，也不以首页几个时刻代表整天。

只在用户问“可能哪年生、什么属相/八字、按本人八字筛选候选”时读取。本模块支持从本人八字提炼适配假设、对应候选年份并实际枚举日期，不把结果表述为唯一现实配偶生日。用户说“推正缘八字再对应年份”时按[条件规划与年份映射](partner-search-plan-method.md)执行，不因无法认证身份而整体拒绝。同一条件可命中多人、多日期；空结果只表示本次范围/条件无命中，不意味着没有正缘。

## 输入与范围

本人完整生辰沿用[原输入口径](input-schema.md)，农历核对闰月，时间未知先走原时辰对照，不能选“最优”时辰当事实。也可提供按年月日时排列的四柱及公历出生年：程序检查干支阴阳、五虎遁、五鼠遁、年柱周期，但不声称验证了真实生日，不由四柱补造紫微盘。

as_of必填客户端参考日期，不取服务器当前年。本人及候选不按年龄拒绝、排除或截短；underage_excluded兼容字段恒为0，eligible_birth_interval是完整立春周期。引擎partner-search/1.0.1区分旧语义，不兼容产物按原输入在新目录重建，范围、结构条件和排序不变。

| 搜索 | 实际计算 | 未知或不能推出 |
| --- | --- | --- |
| years | 每个标签年从立春瞬间到下次立春，含秒并转入指定时区；只算年柱 | 候选日主、夫妻宫、月日时柱、精确生日 |
| dates | 小范围逐日，明确时间或结构边界首中末采样，逐点调用原八字引擎 | 采样点就是现实对象生日、连续分钟概率、性别 |
| people | 用户提供的生辰正向排盘及跨盘关系 | 此人必为正缘、性取向、性能力、医学或生育结论 |

years 默认本人公历出生年±12，1900–2100内一次最多61个立春周期。扩大 year_range 时也要明确 filters.year_gap。year_label_gap 只是标签年/公历年差，不是精确岁差。时区默认沿用本人，只有四柱时为 Asia/Shanghai；不以当地1月1日或春节替代立春。

dates 一次最多31天。默认 unknown 沿用原时辰对照的钟表换日、子时、时辰、节气秒数、时区跳变边界首中末采样，不是穷举每分钟。time_uncertainty 支持 unknown、同日 range 或1–48个 candidates.times；跨日范围拆开，不自动补足。夏令时跳时/重复时间记录 unavailable，不擅改钟表时间。真太阳时须在 search 明确 longitude（可加 longitude_source），options.time_basis=true_solar；本人和 people 的经度仍放 birth。日期假设内部 male 仅满足旧引擎，四柱不依赖它，不据此输出候选紫微、排运、生理或性别。

people 一次1–20人，id 用不重复匿名字母数字连字符；未知时间先对照而不是补造。

机器契约：[输入JSON schema](partner-search-input.schema.json)、[完整结果JSON schema](partner-search-output.schema.json)。两份Draft2020-12 schema按各自$id在本地Registry注册，输出用输入URN引用，无联网取schema。程序另校验真实日期/时区/闰月、干支合法性、端点跨度及checksum。合成示例：[年份](../examples/partner-search/years.json)、[日期](../examples/partner-search/dates.json)、[人物](../examples/partner-search/people.json)、[四柱](../examples/partner-search/pillars.json)，不是用户资料。

## 筛选条件与辅助线索

默认下表前四项，match=any（至少命中一项）；要求全部命中用 all，conditions 可选。默认条件不是综合合婚吉凶结论。[规则层及来源](partner-search-rules.json)区分传统关系依据与项目原创组合。

| condition | 完整候选四柱 | 仅年份候选 |
| --- | --- | --- |
| zodiac_affinity | 本人年支与候选年支六合或同组三合候选 | 同样查表；同组两字不称三合局齐全 |
| spouse_branch_liuhe | 本人日支与候选日支六合 | 本人日支与候选年支六合，不冒称双方夫妻宫合 |
| day_stem_five_combine | 双方日干五合 | 本人日干与候选年干五合，不冒称双方日主合 |
| partner_star_projection | 候选日干相对本人日主命中所选十神模型 | 仅候选年干投影，不是未知对方日主 |
| element_supply | 候选四柱本字/藏干含显式 preferred_elements 的全部元素 | 不支持；不能假定未知月日时五行 |

partner_star_model 默认 all，同时保留正/偏财与正官/七杀；wealth/authority 须明确选择，不由 gender 推断现实伴侣性别或性取向。投影不等于配偶身份。本人各柱财官出现记录、日支和藏干也保留供解释。

月令、通根、透干及双方全部干支关系可据完整盘解释，但本版不以五行数量替代强弱/喜用，不创设综合吉凶分。preferred_elements 只是用户给定条件，不是程序断定的喜用神。真实对象的月令、岁运、紫微等深入分析仍走原 relationship 双盘，不能把当前局部排名当综合合婚。

年上/年下沿用本人已有 age_relation 取象（有紫微才有相应规则），只与候选出生范围方向作辅助展示；不转成固定岁差、不硬筛选、不排序或认定身份。本人只有四柱时不伪造紫微年龄线索。

所有跨盘五合、六合、三合、三会、六冲、六害、六破、成对刑、齐全三刑及规则表自刑按原关系保留。合与冲刑害破不抵消；缺第三字不称合局，不直接判合化。年份模式是本人四柱与候选年柱，group_state=completed_with_candidate / natal_already_complete 区分候选参与齐全与原局已有，不能当用户流年。

exclude_relations 默认空，仅明确要求才硬排除，空结果不自动放宽。排序为所选命中数量降序、绝对标签年差升序、ID；条件并非独立证据，这不是概率、准确率、最佳配偶或婚姻成功率。selected_partner / probability 始终 null，confirmed_partner=false。

古籍支持传统关系表与六亲取象，不提供本程序的“正缘反推公式”；筛选组合/排序标明 PS-PROJECT。sources / condition_references 保留书名篇章、原文转录链接与适用范围，不杜撰原文，不据盘认证前世配偶。

## RikkaHub 调用与复用

由 SKILL.md 链接加载本页，再按本页直接链接读取所需schema/示例。workspace_shell timeout=120；跨月或较大未知时辰日期范围用--batch、timeout=60与返回的续跑参数，不提高至600。检查外层 exitCode/timedOut/truncated，再解析 stdout 检查内层 ok / validation.ok。保留JSON与stderr，不接tr/grep/head管道。

```sh
sh /skills/bazi-ziwei/scripts/mobile.sh --agent --stdin --partner-search --out /workspace/bazi-ziwei-reports/partner-001 <<'SM_INPUT'
{"mode":"partner_search","self":{"birth":{"calendar":"solar","date":"1996-06-15","time":"12:00","gender":"male","timezone":"Asia/Shanghai"}},"as_of":"2026-10-06","search":{"type":"years","year_range":[1984,2008]},"partner_star_model":"all"}
SM_INPUT
```

日期是合成示例，本次须替换。新模式必须有 --agent 和 --partner-search，不用旧 --focus。普通排盘仍用原命令。临时文件的 --temp-input PATH 必须紧跟 --agent，再放 --partner-search，确保无Node时shell也识别并清理；明确保留才 --input。

新搜索只写独立TASK的 chart.json/context.json/validation.json，不覆盖原盘、不写人物记忆、不默认报告。完整大结果由程序保存，不 cat 全文。context.schema_version=suanming-partner-search-context/v1，含本人摘要、coverage、filters、sources、边界与 candidates.total/returned/next_offset/items，默认每页3项，预算自动减小，分页总数不截断。unavailable 显示前3条和total，全部错误点留在chart；关键比较受不可算点影响时明确补证，不忽略。

```sh
sh /skills/bazi-ziwei/scripts/mobile.sh --agent --reuse /workspace/bazi-ziwei-reports/partner-001/chart.json --partner-search --offset 3 --limit 3
sh /skills/bazi-ziwei/scripts/mobile.sh --agent --reuse /workspace/bazi-ziwei-reports/partner-001/chart.json --partner-search --candidate PSY-1997
```

用实际 next_offset / next_actions 翻页，--candidate 用本任务ID展开命中、未命中、出处和全部关系。报告只在明确要求时 --report；工具模板和模型整理报告均不加入年龄排除或成年限制的模板表述，保留用户原题、正常年龄倾向及无法计算采样点说明。同目录不同搜索输入拒绝；改范围、筛选、本人或口径开新任务。缓存核对字节、checksum、版本指纹，失效完整重算；独立receipt不削弱旧缓存。

已有明确旧chart时可省略本次JSON的 self，加 --source-chart 原盘路径；双人盘必须 --source-person a/b。导入前完整核验原盘，复用原生辰，原文件不改。time_compare 不自动挑候选；忘记路径请用户明确选择，不自动取最新命盘。

## 验收

专项覆盖生肖、历法边界、ALL/ANY、完整关系、全部采样、模型、校验、缓存分页、原盘只读导入、锁、临时清理和报告；发布从ZIP解包实跑三种搜索。完整开发回归与当前手机实测分开，结果以本版验收记录为准。

新建partner-search必须指定--out独立任务目录。next_actions.reuse.argv可直接传给mobile.sh，内含路径、选择及游标；逐参数安全引用，不将数组当shell代码。
