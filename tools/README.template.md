# 算命大师（SuanMingMaster）

适配RikkaHub2.5.6的本地命理计算引擎、{topics}主题可检索知识库与Agent工作流。最新版 **V{version}**。

下载 [手机完整安装包](https://github.com/RenCosmos/SuanMingMaster/raw/refs/heads/main/bazi-ziwei-rikkahub-v{version}.zip)，在RikkaHub Skills导入、启用bazi-ziwei并绑定Linux Workspace。包内已有计算依赖，需要Node20+；一次性自检与安装方法见 [手机安装说明](手机安装说明.md)。系统提示词可留空或自定义；[推荐先生口吻](RikkaHub可选系统提示词.txt)完全可选。

支持八字、紫微、六爻铜钱卦、婚恋单盘与双盘、对象画像、单人年上年下取象、真太阳时、未知时辰对照、逐年与大运合冲关系、宫干飞化、疏文表文和民俗修行检索。计算返回小型主题context，追问复用可信缓存；聊天解读为默认，需要时才生成报告。

V{version}修复源盘与输出碰撞、默认参数导致缓存误判、任务目录并发覆盖和嵌套重复计算。39个候选时辰的基础排盘次数从158降到78；临时输入清理后摘要仅写一次。新增9项针对性回归，完整{tests}项测试通过，安装包解包的12组自检、临时输入清理与缓存复用通过。{knowledge_files}份知识/来源/查核/许可文件逐字节保留。

源码、开发测试、固定依赖锁、构建工具和GitHub Actions现作为普通文件入库。见 [开发与发布](DEVELOPMENT.md)、[关键测试说明](references/critical-testing.md)、[验证记录](验证记录.md)。也可下载 [源码ZIP](https://github.com/RenCosmos/SuanMingMaster/raw/refs/heads/main/SuanMingMaster-source-v{version}.zip)。手机包不包含开发测试或生成结果；源码ZIP不含node_modules。安装包手机测试的用户确认记录保留在清单中。

安装包与源码包摘要见 [SHA256SUMS.txt](SHA256SUMS.txt)，结构化验收见 [release-validation.json](release-validation.json)。原创代码和文稿采用MIT，第三方许可和来源见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。
