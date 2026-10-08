# 开发与发布

当前唯一源码在项目根目录，版本以 package.json 为准；不要再按版本复制展开源码。发布物放 releases/v版本号，历史恢复包放 archive，兼容测试夹具放 tools/baselines。

开发环境仍使用 Node24、Python3 和 packageManager 指定的 pnpm；运行时支持 Node20+。pnpm-workspace.yaml 保持扁平、无链接依赖，安装包携带已验证运行依赖。安装依赖只在首次准备环境或锁文件变更时进行：

~~~sh
corepack pnpm install --frozen-lockfile --ignore-scripts
~~~

## 日常：按改动选择，不跑全套

| 修改范围 | 验证方式 |
| --- | --- |
| 纯文档、口吻、目录说明 | git diff --check，核对相关链接/结构；不重算整盘或全年候选 |
| 移动源码、换运行环境 | npm run check：一次12组关键自检，加文件摘要对照 |
| 改动实际功能 | 仅运行对应 tests/*.test.cjs，必要时补关键自检 |
| 正式发布 | release.py 一次完成全量回归、schema、兼容与解包验收 |

专项示例（选择本次相关项，不要全部复制执行）：

~~~sh
node --test tests/knowledge-context.test.cjs
node --test tests/partner-search-plan.test.cjs tests/partner-search-batch.test.cjs
~~~

完整测试文件和所有用例保留；npm test 仍是全量入口，不作为日常默认。npm run test:critical 是含故障注入的开发关键回归，区别于12组运行自检。不要同一轮先跑 npm test 再跑完整 release.py；正式发布直接由构建工具跑一次全套即可。失败修复后只补跑受影响项；最终发布按风险完成一次最终验收，不反复运行无变化的用例。

普通 push / pull_request 的本地 CI 配置只做12组关键自检；手动 workflow_dispatch 或 v 开头的标签才进入完整发布验收，并取消同一分支已过时的运行。本次只是本地配置调整，没有触发或上传 GitHub。

Windows旧Git基线与保留的原文件可能存在CRLF差异；此时使用 git -c core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol diff --check，保留其他空白检查，不改写冻结文件。

手机包不含 tests/，npm test / test:critical 仍明确退出2，提示使用 npm run check；不让0 tests冒充成功。正式发布日志与日常检查分开记录，不将历史通过结果或关键自检称为本轮全量回归。

## 正式发布：一次完整构建

首次配置独立开发环境时安装 schema 验证依赖，随后运行一次构建：

~~~sh
python -m pip install -r tools/schema-validation-requirements.txt
python tools/release.py --out releases/v1.3.9 --schema-validation
~~~

发布下个版本时先按用户要求更新版本，再替换输出目录。输出允许在源码外或专用 releases/ 内；archive、releases、Git 元数据、个人任务输出和开发缓存不进入源码/安装包，AGENTS.md 与全部 tests/tools 只进源码包。Windows 可用 --node 指定 node.exe、--sh 指定 Git sh.exe；开发测试需要 sh 时使用同一环境和可用 PATH。

构建工具完整运行开发用例并拒绝失败、跳过或取消；生成安装ZIP、源码ZIP、SHA256SUMS.txt、test-output.txt 与 release-validation.json，并从安装ZIP解包验收实际工具入口、临时清理、缓存和分页。手机实测仍单独记录，不继承旧版确认。构建和测试不自动提交或上传。

## 知识、依赖与兼容基准

tools/knowledge-baseline.json、tools/compatibility-baseline-v1.2.4.json 和 tools/runtime-dependency-baseline.json 保持冻结。必要文案或代码修复在 tools/reviewed-changes-v1.3.1.json 记录明确旧/新SHA及理由；宗教句子仅允许逐句审定替换，不跳过其他正文、来源或字段。113份知识基线、435份固定依赖继续校验；概念卡各自目录与摘要保持完整。

tools/baselines 中保留 V1.2.4 / V1.2.5 / V1.3.0 的三个固定SHA安装ZIP，仅作真实兼容夹具，不是活跃开发版本。构建优先读取此处，仍兼容以前根目录的基准位置。完整发布继续进行14组计算、85个投影、13种报告/导出、原93主题和旧命盘重验；基准缺失时明确记录未执行，不伪装通过。

五份 references/rikkahub-native 概览继续由 tools/native-knowledge.cjs 只读派生，保持主题、来源、限制和包装预算，不替代正文全集。schema 验证器仅供开发/CI，引用使用本地Registry，不联网解析，也不进入手机包。

## 恢复

工作区整理前的全部旧源码、未提交修改及历史发布物已放 archive/cleanup-2026-10-09，附逐项SHA清单。恢复时按清单选定版本到临时目录，不直接覆盖当前源码，也不要运行归档内含旧绝对路径的维护脚本。主Git历史保留；本次减少的是日常测试次数，不删除功能、知识或开发用例。
