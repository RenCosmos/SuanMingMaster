# 算命大师（SuanMingMaster）

适配RikkaHub2.5.6的本地命理引擎、103主题知识库与Agent工作流。最新版 **V1.4.0**，汇集V1.3.1之后的反馈修复。完整安装包名为bazi-ziwei-rikkahub-v1.4.0.zip，包根bazi-ziwei/SKILL.md；源码ZIP不含计算依赖，不能替代手机安装包。

V1.4.0将整理后的最新版源码与完整安装包统一发布到GitHub，汇集V1.3.6～V1.3.9的已完成修改；相对V1.3.9只同步版本、发布说明和下载入口，不修改计算、筛选、知识内容或输出预算。现有GitHub文件与提交历史保留，旧ZIP不覆盖；仓库根目录的旧包与旧验收文件仅为历史保留，当前下载和校验以V1.4.0 Release为准。

新增跨领域书篇检索修复、合盘交叉证据分页、CLI领域帮助、六张六爻概念卡、完整工具包装终检及长疏文分页；按用户指定直接采用V1.3.5，不表示曾发布中间版本。旧安装包保留不覆盖。

V1.3.7新增[批量日期摘要](references/partner-search-batch-method.md)：全年／跨月一次调用，由程序拆月；每月命中最多、全年命中最多与全部命中条件分开，风险区分采样共同／条件性关系。原引擎、全部时辰采样、完整月份产物、旧CLI和报告不删；默认减少重复工具上下文，不承诺固定token节省比例。

V1.3.8清除候选报告中的未成年人排除文案，并新增[适配条件规划与年份映射](references/partner-search-plan-method.md)。支持从本人八字提出多个候选结构，再对应年柱周期；--plan返回带input的后续argv。可选理论四柱由--batch精确核对实际排盘点，旧无约束批量任务仍可读；不把唯一身份的证据边界当作拒绝假设筛选的理由，不裁剪原计算与未知时辰采样。

V1.3.9调整宗教问答口吻：按用户采用的宗教或民俗传统回答，不主动争论鬼神有无，不把纯宗教问题转成科学或医学科普。三张宗教卡删改无关存在认证插话，出处与教义保留；个人身份确认和具体伤害风险的边界集中到[宗教索引](references/spirit-library-index.md)，不逐条复述为固定免责声明。运行脚本、计算、采样、schema和输出预算与V1.3.8不变。

八字、紫微、六爻、婚恋单/双盘、正缘候选年份/假设生辰/已知对象匹配、年上年下、画像、亲密取象、真太阳时、未知时辰对照、岁运关系、宫干飞化、疏文/表文及民俗修行宗教资料均保留。聊天解读为默认，报告按需；[系统提示词](RikkaHub可选系统提示词.txt)完全可选。安装见[手机说明](手机安装说明.md)，调用见[使用说明](使用说明.md)。

V1.3.1修复新建候选搜索缺--out的入口说明；next_actions.reuse增加完整argv；发布包npm test不再以0 tests成功退出，而是提示使用npm run check。紫微分别标明本命与运限年/月界，原计算配置不改。知识返回明确reference_material / untrusted_reference_text / instruction_authority:none。新增四张实质八字概念卡与术语/别名/领域筛选及最多一次无命中回退。完整核验与判断见[反馈记录](references/feedback-v1.3.1.md)，主Skill按识别→调用→核对→context解读简化，完整细则保留。

完整444项开发测试通过，原296项全部保留；手机包仅有12组关键自检，不包含开发tests/。原93主题、4张八字卡和6张[六爻基础概念卡](references/liuyao-concepts-index.md)均保留，当前共103主题。113份知识冻结基线不改；本次有限宗教措辞、目录和索引按独立旧/新SHA审定，其余资料与435份固定运行依赖逐字保留。完整术语及语境优先，自动领域只参与排序；六爻用神不混同八字喜用，裸词先辨明语境。无运行时可直接读取索引及完整卡片；程序不自动选用神或断完整旺衰。V1.2.4/V1.2.5/V1.3.0实际跨版本计算、投影、报告与正文比较范围见release-validation.json，仅允许明确审定的句子替换，不以“原代码全部未改”描述历代累计修复。

20KiB工作流、12KiB知识/疏文页及28KiB完整转义包装预算保留，包含最终输入清理标记。疏文日常入口加--bounded，可分页还原全文，完整TXT/HTML导出及旧CLI仍保留；维护用全文接口不承诺小型返回。主流程、细则与可选口吻分工去重，解释规则/警告/来源不删；详见[预算与提示词维护](references/output-budget-review.md)。所有计算与原知识功能未裁剪，缓存、任务锁、临时清理和五份无运行时知识概览保留。命理不等同现实事实，不据盘判断性取向、生理能力或医学结论；宗教资料不认证个人鬼神身份、附身或前世配偶。

当前版本的桌面回归和解包验收与手机实测分开记录；历史V1.3.0的用户手机确认不自动继承为新版验收。

开发源码现统一在项目根目录；历史副本放恢复归档，兼容夹具放tools/baselines。日常只执行最小相关检查，完整用例保留至正式发布统一验收，见[维护约定](AGENTS.md)和[开发说明](DEVELOPMENT.md)。

下载[手机完整安装包](https://github.com/RenCosmos/SuanMingMaster/releases/download/v1.4.0/bazi-ziwei-rikkahub-v1.4.0.zip)或[源码ZIP](https://github.com/RenCosmos/SuanMingMaster/releases/download/v1.4.0/SuanMingMaster-source-v1.4.0.zip)。摘要见[SHA256SUMS.txt](https://github.com/RenCosmos/SuanMingMaster/releases/download/v1.4.0/SHA256SUMS.txt)，验收结果见[release-validation.json](https://github.com/RenCosmos/SuanMingMaster/releases/download/v1.4.0/release-validation.json)及[验证记录](验证记录.md)。[V1.4.0发布页](https://github.com/RenCosmos/SuanMingMaster/releases/tag/v1.4.0)包含安装包、源码包和验收附件；本地输出在releases/v1.4.0/。开发与构建方法见[DEVELOPMENT.md](DEVELOPMENT.md)，关键自检见[测试说明](references/critical-testing.md)。构建工具只构建和验收，不自行上传；GitHub发布由维护者另按明确授权执行。原创代码和文稿为MIT；第三方来源、许可及限制见[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。
