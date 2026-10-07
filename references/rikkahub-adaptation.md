# RikkaHub 2.5.6：调用、恢复与手机验收

仅在安装、升级或排障时读；普通任务按 SKILL.md 直接执行。V1.2.5保留全部计算模式、原93主题全文、旧CLI、按需报告和20KiB/12KiB预算，不新增自动重试、后台进程、远端服务或人物档案。

## 宿主调用契约

`use_skill` 可在没有 Linux Workspace 时读取本页链接的技能文件。`workspace_shell` 必须有绑定且就绪的 Rootfs；它不是客户端 JavaScript/QuickJS 引擎。技能资源在 `/skills/bazi-ziwei`，任务文件在 `/workspace/bazi-ziwei-reports/TASK`。只在明确需要保存解读或导出时使用工作区写文件工具。

workspace_shell 参数是 `command`、可选 `cwd` 和 `timeout`。timeout 单位是秒，2.5.6默认30、最大600；正常计算显式120，整天对照/初次自检按需提高，Node安装用600。cwd是相对工作区文件根的目录，例如 `bazi-ziwei-reports/TASK`；使用绝对技能脚本路径时可以省略。

工具外层返回 `exitCode`、`stdout`字符串、`stderr`字符串、`timedOut`及可能出现的`truncated`。先检查外层，再解析 stdout 为内部JSON；不能把 stdout 当已解析的对象。正常排盘要求内层`ok`与`validation.ok`均为true；知识/制文只检查其相应输出，不要求不存在的validation。失败详情通常在stderr的JSON中；缺运行时、无法启动shell等也可能是普通文本。拒绝授权可能返回错误而没有这些shell字段，直接停止，不伪造执行成功。

官方[工具实现](https://github.com/rikkahub/rikkahub/blob/2.5.6/app/src/main/java/me/rerere/rikkahub/data/ai/tools/WorkspaceTools.kt)、[技能读取](https://github.com/rikkahub/rikkahub/blob/2.5.6/app/src/main/java/me/rerere/rikkahub/data/ai/tools/SkillsTools.kt)和[技能导入](https://github.com/rikkahub/rikkahub/blob/2.5.6/app/src/main/java/me/rerere/rikkahub/ui/pages/extensions/skills/SkillsVM.kt)于2026-10-06核对，标签提交为447bb7e89710d31f1204d7a2973baa19fdbd5b28。V1.3.0手机实测由用户于2026-10-07确认，接口源码核对与设备实测分别记录。

## 安装路径区别

安装完整 `bazi-ziwei-rikkahub-v1.3.0.zip`，其根是 `bazi-ziwei/SKILL.md`，包含固定计算依赖。源码ZIP、单独SKILL.md和RikkaHub直接GitHub仓库导入不会自动解压仓库里的安装ZIP；源码仓库不提交node_modules，因此不是完整手机安装方式。升级保留旧安装ZIP及任务文件，重新导入完整新包并运行一次自检。不要删除旧运行时、任务或生辰来“重装”。

## 任务与恢复

`task_id` 是命盘所在路径的短摘要，用于核对同一任务；不是唯一性/安全凭证或全局人物ID。以`files.chart`的明确路径复用，不根据task_id反查人物。没有新增自动持久化索引。

`next_actions`至多给3条建议，省略的分页仍在原`next_offset`、`next_variant_offset`、`people_page`及选择范围中。`reuse`用原files.chart，按建议设置focus、person、offset、years、field、variant_offset；years数组转为`YYYY:YYYY`。`new_calculation/annual_range_uncomputed`指已有盘未算所问流年：核对原输入，调整target_date/annual_count，在新任务目录计算，不擅造年份或把空页说成无事。建议只描述下一步，不执行、不修改输入或决定最佳人物/时辰。

| 状态 | 可采取的下一步 | 不可采取 |
| --- | --- | --- |
| 工具授权拒绝 | 停止，说明哪项权限未获批准 | 改换工具绕过授权 |
| timedOut=true | 只检查本次明确任务目录里的chart.json是否存在；存在则尝试--reuse让程序校验。不成功才询问或以同一原输入在新目录重试一次，必要时提高timeout | 默认认为旧context有效、循环重跑、随意删除结果 |
| task_busy | 稍后最多重试一次，仍忙则请用户选择等待或新任务 | 删锁、杀进程、无限重试 |
| 路径忘记 | 仅列已知任务根下的chart.json路径，让用户选择；不读取全文 | 自动选择“最新”或他人的命盘 |
| 校验和/重算不一致 | 保留文件，恢复原盘或按原输入重算 | 去掉校验、修改数据迎合解读 |
| context_budget_exceeded / truncated=true | 用原chart缩小主题、人物或字段并分页；保留全部原数据 | 解释截断半个JSON、丢掉重要证据 |
| cleanup_error | 说明临时输入被保留及原因，检查该文件 | 扫描/清空工作区 |
| 未算年份 | 在新目录补算明确范围；annual_count仍支持1–20 | 把--years当计算参数、用空页作断语 |

next_actions中的reuse同时保留当前years、person/field等适用筛选和实际limit，执行时不要丢掉这些字段；不要把过滤范围扩大到整盘。offset、variant_offset按具体建议设置，years数组转成YYYY:YYYY。旧选择与分页元数据仍是完整依据。

以上重试是上限，不是必做步骤；输入错误、权限拒绝、校验失败不自动重试。没有结果时不给据盘结论。

## 警告、解释和资料生命周期

双人精简context增加`reading.warnings`，相同消息按`person_ids`去重；单人原warnings、四柱、星曜、交叉关系及所有旧字段仍保留。context增加interpretation_scope，不修改命盘事实、原解释规则或计算口径。亲密专题照常保留十神/宫位/星曜和象征取向；physiological_ability、ability_score继续为null，不推断性取向、性功能、生育能力或疾病。宗教资料只按其传统/来源范围解释，不认证个人鬼神身份或前世配偶。

引擎本身不主动上传生辰；但用户消息及工具输出可能被RikkaHub发送给所选模型供应商。stdin不落中间输入不意味着chart.json不含规范输入，也不意味着聊天完全离线；不自动建立人物记忆或档案。报告与reading.md仍仅明确要求时保存。

## 手机验收与排障复核清单

V1.3.0安装包已由用户于2026-10-07确认完成手机实测。以下清单供后续升级及排障复核，不作为逐项实测日志。

1. 导入完整ZIP、启用技能、绑定默认Ubuntu/Debian Workspace；运行一次--check --self-test，12/12成功。
2. 普通八字/紫微、单人关系、双人关系：一次shell返回完整JSON；双人默认仍含双方与交叉关系，警告未丢。
3. 连续换主题追问：task_id相同、cache_hit=true、calculation_performed=false；不反复自检/生成报告。
4. 整天未知时辰、候选与字段分页、20年年度分页：范围不缺失，不把页内或候选点数当总体概率。
5. 护法/前世姻缘等纯知识：不收生辰；有Node时检索全文，无Node时use_skill读取概览，不声称看过未加载原文。
6. 模拟缺Node、未就绪Workspace、授权拒绝、超时、任务忙、旧盘校验失败：按状态停止/恢复，不绕过权限、不删除文件。
7. 明确要求报告和疏文横排/竖排导出：旧接口仍可用；未要求时聊天回答，不自动创建报告。

后续复核可记录手机型号、Rootfs、Node/ICU/时区数据库版本、所用模型、外层工具状态及失败编号；不要上传真实生辰、完整命盘或私密关系叙述作测试日志。手机实测的来源是用户确认，不编造设备型号或逐项执行日志。
