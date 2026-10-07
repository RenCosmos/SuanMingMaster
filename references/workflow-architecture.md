# V1.3.5 本地引擎、检索与 Agent 工作流

这是维护接口文档，普通用户问答无需读取。

V1.3.0新增独立链路：mobile.sh --agent 输入选项 --partner-search → workflow分派 → partner-search-workflow.cjs → partner-search.cjs → 原engine/relationship/关系表 → 完整重算核验 → 独立分页context/receipt。不改runtime-core的四个适配器、mobile.sh、原算法或旧mode契约。--source-chart只读核验旧盘后导入原生辰；年份仅年柱、日期逐点假设、人物为用户输入。方法、schema、规则层和RikkaHub命令见[候选筛选](partner-search-method.md)。新receipt同样使用原版本指纹、路径身份检查、任务锁与输入生命周期；原接口及预算不变。

实际链路：mobile.sh → workflow.cjs → runtime-core.cjs 适配器 → 原排盘算法 → 同次统一重算校验 → context.cjs 主题投影 → 有界 stdout。知识任务进入 knowledge-context.cjs → knowledge.cjs；日常制文为 shuwen.cjs --bounded → shuwen-context.cjs → 原build/导出。完整制文旧入口保留。

| 层 | 已实现接口 | 扩展约束 |
| --- | --- | --- |
| 本地计算 | runtime-core 的 ADAPTERS、adapter、buildAndValidate、verify、integrity；四个惰性适配器 chart / relationship / time_compare / divination | 新引擎注册 input_modes、schemas、module、report；必须提供 build、validateArtifact 和 makeReport；计算规则放引擎与规则表 |
| 上下文 | context.project(data, options)，suanming-context/v1 | 新 focus 注册 FOCUSES 及投影；保持真实证据 ID、来源校验和、选择范围和分页；不得在投影中改排盘规则 |
| 可检索知识 | knowledge-context.retrieve(query)，suanming-knowledge-context/v1 | 查询和正文窗口分开，带 source_url、sha256 和 next_offset；93主题原文不删减；legacy knowledge.lookup 保留；无运行时备用概览不替代原文 |
| Agent 工作流 | workflow.operation(argv)、workflow.main(argv)，CLI 与函数同入口 | 编排输入、验证缓存、计算、上下文和按需报告；宿主只依赖 JSON 契约，不依赖内部文件遍历 |

## 输出与预算

普通任务只写 chart.json、context.json、validation.json；对照完整候选都在 chart.json，不再默认额外生成庞大 comparison.json。stdout 与 context.json 同一响应，含 workflow_version、adapter_id、cache_hit、calculation_performed、validation、files、context 和 output。返回的 context 是可继续提取的计算视图，不是完整命盘或最终文章。SKILL.md 自带职责、执行与解读约定，context 同时带据盘解读提示；无需额外系统提示词，用户可自由设置语气和角色。预测先答判断、证据与所问时机，现实建议按需补充。

普通排盘默认 core，关系模式默认 relationship；career/wealth/annual 选对应主题；专项 age_relation/partner_image/intimacy 按需。年度列表含显干和藏干十神、pillar_relations、day_branch_relations，保留 touches_day_branch、group_state、natal_group_present 等原局与岁运关系标志。宫干飞化聚焦发出或落入该主题主宫，flying_scope 明确范围；完整48项仍在 chart。双人共同摘要可用 --person 扩展个人细节，预算不足时 people_page 明示下一人。

V1.2.5只增补字段：workflow返回task_id和至多3条next_actions；context增加interpretation_scope，双人reading增加按person_ids去重的warnings。task_id只用于核对路径，不建人物索引；next_actions只给分页/补算建议，不执行、不猜选择。新错误recovery与原ok/error/type并存，退出码和stderr位置不变。原文件、字段、模式、方法、报告及旧CLI全部保留。细节与手机验收见[适配与恢复](rikkahub-adaptation.md)。

output-budget.cjs统一计算stdout全响应UTF-8字节及JSON转义后的完整shell包装 `{exitCode:0,stdout,stderr:"",timedOut:false}`，包括末尾换行和导航参数。工作流硬限20KiB，知识/疏文页12KiB，包装小于28KiB；不放宽原预算。工作流/疏文投影预留128字节，知识预留256字节；临时输入清理等最终字段加入后再检查全部预算，通过才发布context或stdout。output.bytes为最终stdout字节数。

列表超预算自动减小limit；疏文减小chars，next_offset由实际返回范围计算。不切割序列化JSON、不吞错误；最小投影仍超预算返回context_budget_exceeded，计算原盘及完整文稿保留。知识查询过大时明确要求减小limit/chars，不以截断替代正常分页。

RikkaHub2.5.6固定提交447bb7e89710d31f1204d7a2973baa19fdbd5b28的[消息生成文档](https://github.com/rikkahub/rikkahub/blob/447bb7e89710d31f1204d7a2973baa19fdbd5b28/docs/references/chat-generation-pipeline.md)记录：具备Workspace Shell时，超32KB工具输出前4KB保留，其余全文存入tool_outputs。[WorkspaceTools](https://github.com/rikkahub/rikkahub/blob/447bb7e89710d31f1204d7a2973baa19fdbd5b28/app/src/main/java/me/rerere/rikkahub/data/ai/tools/WorkspaceTools.kt)确认上述包装字段；2026-10-08再次核对。预算避开这条工具截断路径，不保证所有模型供应商的上下文/最终回复限制。--engine、--knowledge-full、完整制文旧CLI及手动读取整文件不受本层保护，不能用作日常小型返回。V1.3.0手机确认仅是历史记录，不继承为本地改动设备验收。

疏文新增可选--bounded（--offset N、--chars 200..3000），返回text_page、document_sha256和带完整argv的next_actions。续页需同一原始JSON，经stdin重放，不缓存生辰/文稿输入、不复用已清理文件；不重复--out。逐页text可还原原完整文稿，完整TXT/横排或竖排HTML导出仍由原operation一次完成。旧build/text/parts和不带--bounded的CLI行为不改，详见[制文方法](shuwen-method.md)。

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

## V1.3.1增量

next_actions.reuse新增entrypoint=scripts/mobile.sh及完整argv数组；原选择字段与new_calculation语义保留。知识库原93主题不改，新增4张独立八字概念卡；knowledge-search提供最长术语优先、繁简别名、显式/推定领域及无命中一次问句回退。snippet和正文均是untrusted_reference_text、instruction_authority:none。紫微新增本命/运限年界标签，原算法不动；旧无标签命盘仍重算全部计算事实，仅对确实缺失的新增标签做兼容视图，源盘不改。

## 本地反馈续修：古籍检索与合盘分页

检索先按目录中的 book/chapter 和标题识别书篇；retrieval.domain/domain_source 是排序提示，不能据此认为其他领域已被排除。retrieval.filter_domain 只有用户显式传 --domain 时才非空并严格筛选。完整术语优先，含“用神”不自动升级为“喜用神”；原问句回退仍最多一次，不改原97主题正文。

双人 core/relationship/intimacy 超预算回退单人页时，reading.pair_evidence.missing 列出当前响应缺少的另一人物与 comparison。先执行 people_page.next_person 对应 argv，该人物页的 next_actions 会返回 --comparison 的完整 argv；显式 --person 查询也会提供这个入口。它清除人物和年度筛选、使用 focus=relationship，不需要模型改拼命令。

交叉页命令：`sh /skills/bazi-ziwei/scripts/mobile.sh --reuse CHART --comparison --focus relationship --offset 0 --limit 3`。只用于双人关系盘，不与 --person、--years 或时辰筛选混用。旧 focus 与默认双人投影不变。context.selection.comparison=true 区分该视图；reading.comparison 保留原 comparison 的 id/kind、双向日主投影和独立紫微对照。bazi.cross_relations 和 pillar_matrix 各带 total/offset/items/next_offset，items 为完整原记录，含双方 source IDs。共享 comparison_page 按较长列表的 total 推进，较短列表读完后可能为空，不能用它覆盖前页已读证据。next_actions 给下一共享页的完整 argv。

pair_evidence.page_is_last 只表示到达列表末尾；comparison_complete_in_this_response 只有从 offset=0 且本页覆盖全部交叉列表才为 true。末页或越界空页会提示 comparison_previous_pages，不能当作交叉关系为空或全文已读。合盘解读合并同一 task_id/source_checksum 的 a/b 与全部必要交叉页；未取得交叉证据时只能解释单盘，不能补造合盘结论。全部输出仍在20KiB/转义包装28KiB内，旧 chart.json 不改写、可信缓存不重算。
