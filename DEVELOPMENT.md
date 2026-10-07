# 开发与发布

版本以package.json为准；构建工具生成相关版本标签及验证记录。Node24、Python3、packageManager指定版本的pnpm为开发环境，运行时仍支持Node20+。pnpm-workspace.yaml配置扁平且无符号链接的依赖目录，确保ZIP解压后可独立运行；.npmrc仅用于旧版pnpm兼容。

```sh
corepack pnpm install --frozen-lockfile --ignore-scripts
corepack pnpm test
python -m pip install -r tools/schema-validation-requirements.txt
python tools/release.py --out ../release --schema-validation
```

Windows可通过--node指定node.exe、--sh指定Git sh.exe。所有开发测试留在源码；手机包仅携带运行代码、知识、使用资料、必要示例和12组关键自检。输出目录须在源码目录之外。

release.py直接运行当前测试并检查退出码，拒绝失败/跳过；逐字节查核知识基线，生成安装ZIP及不含node_modules的源码ZIP，检查归档与本地链接，然后从安装ZIP解包做自检、临时输入清理和缓存复用验收。验证结果在release-validation.json，测试日志在构建输出目录。GitHub Actions调用同一构建命令。

新增或更新知识时，明确审查来源/许可和正文后更新tools/knowledge-baseline.json；常规代码修复无需改该基线。tools/runtime-dependency-baseline.json保留已验证的运行依赖文件及哈希，生成手机包时按清单选取，排除包管理器本机路径元数据、重复缓存和开发声明文件。更新依赖时需复核该清单与冻结锁文件，再做解包验证。构建工具不自行上传，测试通过后再发布下载文件。

V1.2.5新增tools/compatibility-baseline-v1.2.4.json与verify-compatibility.cjs：冻结78份引擎/旧CLI/报告/方法/示例/基线文件，并复验原113份知识、435份运行依赖。构建时若仓库保留已核SHA的V1.2.4安装ZIP，会安全解包并进行跨版本14组计算、85个主题投影、13种报告/导出和93主题全文对照；没有旧ZIP时明确只报告字节保护，不冒称已执行跨版本对照。源码ZIP不含历史安装ZIP，可从已发布版本取得旧包完成同样验收。

五份references/rikkahub-native概览由tools/native-knowledge.cjs的只读渲染函数派生；测试逐字核对目录、来源及推断限制并限制每页包装后28KiB内。它们是无运行时增补，不覆盖原目录、原文或检索。更新生成页仍须用正常文件编辑流程，生成器本身不写文件。

V1.3.0的候选筛选保持独立模块、规则及schema，不扩写冻结原计算层。examples/partner-search子目录存合成输入，不加入旧顶层接口回归集合。持有V1.2.5安装ZIP时构建另核固定SHA并做相同跨版本验收，逐字检查该版原脚本（仅workflow允许分派增补）与五份原生概览；没有旧包明确记录未执行，不修改基线放行。解包验收使用mobile --agent入口实际运行years/dates/people、分页及缓存。升级新功能的详细验收范围见专项方法和tests/partner-search.test.cjs。

schema校验器只用于开发/CI（可安装在独立虚拟环境或测试目录），不改变Node运行依赖，不进手机包。--schema-validation用独立Draft2020-12实现检查两份schema、四类原始/归一化输入及完整输出，并验证概率和年份补造四柱被拒绝。输入schema按其URN在本地Registry注册，绝不联网解析引用；未启用该选项时结构化结果明确performed=false，不冒称已独立校验。

V1.3.1的开发测试使用scripts/test-runner.cjs，显式枚举测试文件；没有tests或缺关键测试时退出码2，不显示0 tests成功。手机安装包只运行npm run check的12组关键自检；开发完整回归仍在源码。原296项用例保留，新增反馈回归；旧主题计数断言明确排除新4卡，继续保护原93主题。

本次必要代码修复以tools/reviewed-changes-v1.3.1.json单独记录基于V1.3.0提交的旧/新SHA和理由；不重写冻结V1.2.4知识或依赖基线。跨版本比较只允许新增年界标签（旧盘缺失时重算嵌套摘要）及精确报告标签差异，其他计算与旧字段严格保留；实际旧命盘也验证。V1.3.0安装ZIP有固定SHA时增加该版本对照。四卡有独立目录与哈希，不改旧93主题；双人共同context仅共用新增年界说明，保留双方原字段及预算。详见[反馈记录](references/feedback-v1.3.1.md)。

V1.3.5汇集后续反馈修复，保持计算层与原97主题正文不变，新增六爻六卡和有界疏文投影；兼容审定清单沿用历史文件名tools/reviewed-changes-v1.3.1.json，其release字段同步为当前版本。构建额外核验完整shell包装、古籍检索、合盘comparison可达性与长疏文逐页还原。旧安装ZIP保留作真实回归基线，手机验收不继承历史确认。
