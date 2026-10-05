# 算命大师（SuanMingMaster）

适配RikkaHub2.5.6的本地命理计算引擎、85主题可检索知识库与Agent工作流。最新版 **V1.2.2**。

## 下载与安装

1. 下载 [手机完整安装包](https://github.com/RenCosmos/SuanMingMaster/raw/refs/heads/main/bazi-ziwei-rikkahub-v1.2.2.zip)，在RikkaHub Skills中导入，启用bazi-ziwei并绑定Linux Workspace。也可打开ZIP文件页点击Download raw file。
2. 需要Node.js20+；依赖随包携带，无需npm安装。安装及一次性关键自检见 [INSTALL.md](INSTALL.md)。
3. **系统提示词可留空或自定义。** 想采用民间算命先生口吻时，可选用 [推荐提示词](RikkaHub可选系统提示词.txt)。它不作为运行依赖；旧版专用提示词可以移除。

支持八字、紫微斗数、六爻、单人/双人婚恋、对象画像、单盘年上年下取象、真太阳时、出生时辰对照、逐年及大运合冲关系、宫干飞化、疏文/表文和85主题民俗修行检索。普通解读先答命理判断、依据和时机；用户需要时才生成报告。

程序默认返回小型已校验context，按问题选择focus，已验证命盘缓存复用。检索直接传参；临时输入成功或异常均清理。103份知识/来源/查核/许可文件完整保留，与V1.2.1逐字节一致。

## V1.2.2关键测试

手机安装包只附 **12组精简自检**，不附tests、完整测试日志或生成结果。新增 **29项关键开发验证**，覆盖固定预期、错误注入、真实shell入口、上下文预算、20年分页、缓存与隐私输入清理。完整 **231项测试通过，零失败、零跳过**。计算算法和知识原文不变。

开发者下载 [源码与开发测试](https://github.com/RenCosmos/SuanMingMaster/raw/refs/heads/main/SuanMingMaster-source-v1.2.2.zip)，解压后安装固定依赖并运行npm run test:critical或npm test。具体用例、出处及失效检测见 [TESTING.md](TESTING.md)。安装包同时包含可直接运行的完整程序源码及依赖。

原V1.2.1安装包的手机端测试已由用户确认；新版本沿用该工作流与计算依赖。随包验证记录列明本次自动化结果。V1.1.5 ZIP是历史版本，请使用上面的V1.2.2下载链接；旧提示词文件仅为历史兼容说明。

安装包与源码包SHA-256见 [SHA256SUMS.txt](SHA256SUMS.txt)。代码及原创文稿采用 [MIT](LICENSE)，第三方内容保留各自许可，完整声明及来源随包保留。
