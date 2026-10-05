# V1.2.3 本地引擎、检索与 Agent 工作流

这是维护接口文档，普通用户问答无需读取。

实际链路：mobile.sh → workflow.cjs → runtime-core.cjs 适配器 → 原排盘算法 → 同次统一重算校验 → context.cjs 主题投影 → 有界 stdout。知识任务进入 knowledge-context.cjs → knowledge.cjs；制文仍用 shuwen.cjs。

| 层 | 已实现接口 | 扩展约束 |
| --- | --- | --- |
| 本地计算 | runtime-core 的 ADAPTERS、adapter、buildAndValidate、verify、integrity；四个惰性适配器 chart / relationship / time_compare / divination | 新引擎注册 input_modes、schemas、module、report；必须提供 build、validateArtifact 和 makeReport；计算规则放引擎与规则表 |
| 上下文 | context.project(data, options)，suanming-context/v1 | 新 focus 注册 FOCUSES 及投影；保持真实证据 ID、来源校验和、选择范围和分页；不得在投影中改排盘规则 |
| 可检索知识 | knowledge-context.retrieve(query)，suanming-knowledge-context/v1 | 查询和正文窗口分开，带 source_url、sha256 和 next_offset；85主题原文不删减；legacy knowledge.lookup 保留 |
| Agent 工作流 | workflow.operation(argv)、workflow.main(argv)，CLI 与函数同入口 | 编排输入、验证缓存、计算、上下文和按需报告；宿主只依赖 JSON 契约，不依赖内部文件遍历 |

## 输出与预算

普通任务只写 chart.json、context.json、validation.json；对照完整候选都在 chart.json，不再默认额外生成庞大 comparison.json。stdout 与 context.json 同一响应，含 workflow_version、adapter_id、cache_hit、calculation_performed、validation、files、context 和 output。返回的 context 是可继续提取的计算视图，不是完整命盘或最终文章。SKILL.md 自带职责、执行与解读约定，context 同时带据盘解读提示；无需额外系统提示词，用户可自由设置语气和角色。预测先答判断、证据与所问时机，现实建议按需补充。

普通排盘默认 core，关系模式默认 relationship；career/wealth/annual 选对应主题；专项 age_relation/partner_image/intimacy 按需。年度列表含显干和藏干十神、pillar_relations、day_branch_relations，保留 touches_day_branch、group_state、natal_group_present 等原局与岁运关系标志。宫干飞化聚焦发出或落入该主题主宫，flying_scope 明确范围；完整48项仍在 chart。双人共同摘要可用 --person 扩展个人细节，预算不足时 people_page 明示下一人。

stdout 全响应硬限20KiB UTF-8，并校验 JSON 转义后 shell 包装估算小于28KiB；知识响应限12KiB。列表超预算自动减小 limit，所有 next_offset 由实际返回条数计算。不裁剪 JSON 字符串，不吞掉错误；最小投影仍超预算时返回 context_budget_exceeded，指引收窄选择，计算结果仍可复用。输出预算为宿主包装预留空间。

RikkaHub [官方消息生成文档](https://github.com/rikkahub/rikkahub/blob/master/docs/references/chat-generation-pipeline.md)记录：具备 Workspace Shell 时，超32KB工具输出前4KB保留，其余全文存入 tool_outputs。此处主动限制输出以避开该路径，不修改客户端。该文档核对于2026-10-05；本技能安装包的手机端测试已由用户确认。

## 验证与缓存

新结果先调用原引擎 validateArtifact 完成重算校验，CLI 只需一次 shell；父层统一重算并比较完整结果，子层只做结构与校验和检查，避免嵌套重复重算。validation.json 记录结果文件 SHA-256、canonical checksum、输入键、程序/规则/依赖/运行时 fingerprint 和验证状态。数据文件与凭据按临时同目录文件写入、rename发布，finally清理写入中间文件。

复用时只核对完整文件字节、canonical checksum 和版本凭据，不重新排盘、不全量自检，也不加载未用的排盘引擎。没有有效凭据的旧 chart 第一次会完整重算验证后建立凭据；篡改、规则变化或运行时变化不直接信任旧结果。fingerprint 覆盖 scripts/*.cjs、顶层规则 JSON、package.json、依赖 package.json 与 Node/ICU/时区数据版本。依赖内容的验收由冻结安装包、自检与安装校验提供；不做每次 node_modules 全文件扫描。

输入键保留模式、出生资料、目标日期、全部口径、候选范围、关系 topics 和配偶星模型；不含 label、question、context.narrative 等呈现文本。更改这些文本能复用计算，解读使用当前对话；缓存文件里的旧叙述不用于替代当前叙述。键由各适配器的无排盘归一化接口生成，省略默认值与显式默认值等价。任务目录独占锁保护归属检查、计算、临时输入清理与一次最终摘要发布；同目录不同计算输入报错，防止覆盖别人或旧任务；新资料开新目录。--refresh 携带原输入强制重算，不绕过数据校验。

凭据是受用户控制的本地缓存完整性记录，不是防恶意用户伪造的数字签名。--reuse 不要求重新提交出生输入；缓存只在本地任务目录。无全局人物档案、远端服务或自动上传。

## 文件生命周期与兼容

stdin、命令行知识参数均不生成中间输入。--temp-input 沿用 Node finally 和 shell trap；新增结果名 context.json、brief.json、validation.json 纳入防误删保护。任务结果用于追问，不默认导出报告；--report / legacy --render 明确请求才写报告。临时写入文件在正常或异常路径清理，强制断电或 SIGKILL 无法运行 finally，遗留临时文件不作为有效缓存。

旧 scripts/run.cjs 命令与模块未改，mobile.sh --engine 进入旧完整数据 CLI；--verify / --render / --extract 继续旧维护接口，--knowledge-full 保留旧全文输出。普通 Agent 走新入口，不调用这些维护接口。V1.1.6 原安装包按原始字节冻结，可还原旧运行行为。V1.2.0 没有新增远程 MCP / HTTP / 数据库或向量服务；上述惰性适配器和版本 JSON 契约是未来挂接它们的边界。

## 输出保护与任务锁

写入前核对全部输出与输入/复用盘的真实路径及已存在文件身份，冲突立即报错，源盘不修改。锁文件为.suanming-task.lock，记录本机进程与随机持有者令牌；多目录按排序获取，冲突返回task_busy。正常和异常路径释放自己的锁；同主机已结束进程的锁自动恢复。活跃进程、无法判断的记录和其他主机的锁不自动移除，需检查任务后处理。主进程强制结束后下一次可恢复已结束进程的锁。缓存命中同样受锁保护。
