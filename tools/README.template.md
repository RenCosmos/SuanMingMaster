# 算命大师（SuanMingMaster）

适配RikkaHub2.5.6的本地命理计算引擎、{topics}主题可检索知识库与Agent工作流。最新版 **V{version}**。

下载 [手机完整安装包](https://github.com/RenCosmos/SuanMingMaster/raw/refs/heads/main/bazi-ziwei-rikkahub-v{version}.zip)，在RikkaHub Skills导入、启用bazi-ziwei并绑定Linux Workspace。包内已有计算依赖，需要Node20+；一次性自检与安装方法见 [手机安装说明](手机安装说明.md)。系统提示词可留空或自定义；[推荐先生口吻](RikkaHub可选系统提示词.txt)完全可选。

支持八字、紫微、六爻铜钱卦、婚恋单盘与双盘、对象画像、单人年上年下取象、真太阳时、未知时辰对照、逐年与大运合冲关系、宫干飞化、疏文表文和民俗修行检索。计算返回小型主题context，追问复用可信缓存；聊天解读为默认，需要时才生成报告。

V{version}新增[正缘候选筛选](references/partner-search-method.md)：根据本人八字，在明确范围筛年份、假设生辰或用户提供对象；除了生肖，还核对日干/日支锚定及十神条件，保留跨盘合冲刑害破。仅知年份不补造月日时柱；假设日期不是现实对象已知生日，命中数量不是概率。保留RikkaHub 2.5.6调用、超时与恢复、task_id/next_actions/双人警告和五类原生知识概览。所有旧计算、CLI、93主题全文、报告/疏文、固定依赖、缓存及输出预算不变。具体手机验收见[适配与恢复](references/rikkahub-adaptation.md)。宗教来源及推断限制保留，不认证个人鬼神身份或前世配偶；亲密取象不推断性取向、生理能力或医学结论。

保留原261项并新增候选筛选回归，完整{tests}项测试通过；安装包解包12组自检、宗教检索、原工作流及三种新搜索的临时清理/缓存复用通过。{knowledge_files}份知识/来源/查核/许可、435份运行依赖及78份引擎/旧接口/方法等按V1.2.4审定基线逐字节校验；持有冻结V1.2.4/V1.2.5安装ZIP时另做跨版本计算、投影、报告/导出及93主题全文对照，实际范围见release-validation.json。{mobile_notice}原V1.2.1确认保留在历史记录中。

源码、开发测试、固定依赖锁、构建工具和GitHub Actions现作为普通文件入库。见 [开发与发布](DEVELOPMENT.md)、[关键测试说明](references/critical-testing.md)、[验证记录](验证记录.md)。也可下载 [源码ZIP](https://github.com/RenCosmos/SuanMingMaster/raw/refs/heads/main/SuanMingMaster-source-v{version}.zip)。手机包不包含开发测试或生成结果；源码ZIP不含node_modules。安装包手机测试的用户确认记录保留在清单中。

安装包与源码包摘要见 [SHA256SUMS.txt](SHA256SUMS.txt)，结构化验收见 [release-validation.json](release-validation.json)。原创代码和文稿采用MIT，第三方许可和来源见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。
