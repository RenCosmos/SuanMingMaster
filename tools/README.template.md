# 算命大师（SuanMingMaster）

适配RikkaHub2.5.6的本地命理引擎、{topics}主题知识库与Agent工作流。最新版 **V{version}**，汇集V1.3.1之后的反馈修复。完整安装包名为bazi-ziwei-rikkahub-v{version}.zip，包根bazi-ziwei/SKILL.md；源码ZIP不含计算依赖，不能替代手机安装包。

新增跨领域书篇检索修复、合盘交叉证据分页、CLI领域帮助、六张六爻概念卡、完整工具包装终检及长疏文分页；按用户指定直接采用V1.3.5，不表示曾发布中间版本。旧安装包保留不覆盖。

八字、紫微、六爻、婚恋单/双盘、正缘候选年份/假设生辰/已知对象匹配、年上年下、画像、亲密取象、真太阳时、未知时辰对照、岁运关系、宫干飞化、疏文/表文及民俗修行宗教资料均保留。聊天解读为默认，报告按需；[系统提示词](RikkaHub可选系统提示词.txt)完全可选。安装见[手机说明](手机安装说明.md)，调用见[使用说明](使用说明.md)。

V1.3.1修复新建候选搜索缺--out的入口说明；next_actions.reuse增加完整argv；发布包npm test不再以0 tests成功退出，而是提示使用npm run check。紫微分别标明本命与运限年/月界，原计算配置不改。知识返回明确reference_material / untrusted_reference_text / instruction_authority:none。新增四张实质八字概念卡与术语/别名/领域筛选及最多一次无命中回退。完整核验与判断见[反馈记录](references/feedback-v1.3.1.md)，主Skill按识别→调用→核对→context解读简化，完整细则保留。

完整{tests}项开发测试通过，原296项全部保留；手机包仅有12组关键自检，不包含开发tests/。原93主题全文、4张八字卡、{knowledge_files}份知识基线和435份固定运行依赖逐字保留；增补6张[六爻基础概念卡](references/liuyao-concepts-index.md)，当前共{topics}主题。完整术语及语境优先，自动领域只参与排序；六爻用神不混同八字喜用，裸词先辨明语境。无运行时可直接读取索引及完整卡片；程序不自动选用神或断完整旺衰。旧冻结基线不改，必要修复的少数代码按独立旧/新SHA审定清单验收。V1.2.4/V1.2.5/V1.3.0实际跨版本计算、投影、报告与正文比较范围见release-validation.json，不以“原代码全部未改”描述本版。

20KiB工作流、12KiB知识/疏文页及28KiB完整转义包装预算保留，包含最终输入清理标记。疏文日常入口加--bounded，可分页还原全文，完整TXT/HTML导出及旧CLI仍保留；维护用全文接口不承诺小型返回。主流程、细则与可选口吻分工去重，解释规则/警告/来源不删；详见[预算与提示词维护](references/output-budget-review.md)。所有计算与原知识功能未裁剪，缓存、任务锁、临时清理和五份无运行时知识概览保留。命理不等同现实事实，不据盘判断性取向、生理能力或医学结论；宗教资料不认证个人鬼神身份、附身或前世配偶。

{mobile_notice}

下载[手机完整安装包](https://github.com/RenCosmos/SuanMingMaster/raw/refs/heads/main/bazi-ziwei-rikkahub-v{version}.zip)或[源码ZIP](https://github.com/RenCosmos/SuanMingMaster/raw/refs/heads/main/SuanMingMaster-source-v{version}.zip)。摘要见[SHA256SUMS.txt](SHA256SUMS.txt)，验收结果见[release-validation.json](release-validation.json)及[验证记录](验证记录.md)。开发与构建方法见[DEVELOPMENT.md](DEVELOPMENT.md)，关键自检见[测试说明](references/critical-testing.md)。发布工具只构建和验收，不自行上传；上传由维护者另行授权。原创代码和文稿为MIT；第三方来源、许可及限制见[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。
