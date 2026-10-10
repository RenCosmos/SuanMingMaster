# RikkaHub 2.5.6：安装与恢复

仅安装、升级或排障时读；日常执行与状态统一遵循[SKILL.md](../SKILL.md)，证据续页见[分页契约](pagination-guide.md)。本页不另设角色，也不要求日常自检。

## 宿主契约

use_skill可读取技能文件；计算用workspace_shell，须绑定就绪的Linux Rootfs，不是QuickJS。技能在/skills/bazi-ziwei，任务在/workspace/bazi-ziwei-reports/TASK。参数为command、可选cwd及timeout（秒）；cwd是工作区相对目录，可省略。

普通／规划timeout=120，批量60且程序默认20秒软预算，Node安装单独120。外层有exitCode、stdout字符串、stderr、timedOut及可选truncated；先查状态再解析stdout。排盘内层ok／validation.ok须true；批量yielded是正常进度，知识／制文不要求不存在的validation。错误可能是stderr JSON或环境文本；授权拒绝直接停止。

## 安装与升级

导入当前标准ZIP，根为bazi-ziwei/SKILL.md，计算依赖已包含；源码ZIP、单独SKILL.md或直接仓库导入不能代替完整安装。升级重读主Skill，保留已有运行时和用户任务。

mobile.sh复用系统或工作区私有Node；仅runtime_missing时按[手机安装说明](../手机安装说明.md)单独运行install-node.sh，缺基础工具才根据实际错误引导apt。bundled_dependencies_missing应重新导入完整包，不在/workspace复制脚本或重复npm安装。安装与计算分开，安装／升级自检一次；--check显示实际Node及依赖来源。

## 状态恢复

| 状态 | 下一步 | 不要做 |
| --- | --- | --- |
| 授权拒绝 | 停止并指出未获权限 | 换工具绕过 |
| batch yielded | 执行返回的--resume argv，原目录续跑 | 重建输入、多年份并发、提前断全年最高 |
| 普通任务timedOut | 只检查本次明确chart路径；存在则--reuse校验，失败才按原输入在新目录最多重试一次 | 信任旧context、循环重跑、删结果 |
| 批量timedOut | 定位本次batch.json，--reuse --resume；保留月份与日断点 | 找普通chart或重建全年任务 |
| task_busy | 稍后最多重试一次，仍忙请用户选择等待或新任务 | 删锁、杀进程、无限重试 |
| 路径忘记 | 只列已知任务根下chart路径，请用户选择 | 自动取最新或他人的命盘 |
| 校验／重算不一致 | 保留文件，恢复原盘或按原输入补算 | 去校验、改结果迎合解读 |
| context_budget_exceeded／truncated | 用原盘缩小主题／人物／字段并续页 | 解释半个JSON、丢重要证据 |
| cleanup_error | 检查明确保留的临时输入 | 清空工作区 |
| 未算年份 | 新目录补算明确范围，annual_count支持1–20 | 将--years当计算、以空页断无事 |

重试是上限，不是必做步骤；输入错误、拒绝授权、校验失败不自动重试。保留JSON和stderr，不接tr/grep/head或2>/dev/null。没有有效结果不作据盘结论。

task_id仅是路径短摘要，不是身份或安全凭证；复用files.chart。next_actions.argv已含路径、选择和游标，逐项安全引用，不手动转换years或重拼。普通new_calculation没有可执行argv；[规划动作](partner-search-plan-method.md)另附argv及input，将input送stdin。建议不代用户选择人物或最佳时辰。

## 官方等待与截断机制

2026-10-09核对官方2.5.6：[工具实现](https://github.com/rikkahub/rikkahub/blob/2.5.6/app/src/main/java/me/rerere/rikkahub/data/ai/tools/WorkspaceTools.kt)定义timeout默认30秒、上限600秒；[进程等待](https://github.com/rikkahub/rikkahub/blob/2.5.6/workspace/src/main/java/me/rerere/workspace/WorkspaceShellRunner.kt)在waitFor结束后集中返回输出，超时强制结束并等待采集线程最多1秒，不是实时终端。600允许十分钟，不会加速。

[PRoot执行器](https://github.com/rikkahub/rikkahub/blob/2.5.6/workspace/src/main/java/me/rerere/workspace/ProotShellRunner.kt)使用bash与--kill-on-exit，环境准备在进程计时前。120秒调用若总等待超过五分钟，需完整日志区分审批、启动及连续工具调用，不能只凭截图认定原因。手机重复文件操作成本可能更高，属推断而非设备测量。

[官方生成管线](https://github.com/rikkahub/rikkahub/blob/2.5.6/docs/references/chat-generation-pipeline.md)另有超过32KiB后的消息截断；本项目20KiB响应和28KiB包装余量用于避开该路径，与计算时长是两回事。接口标签提交为447bb7e89710d31f1204d7a2973baa19fdbd5b28。

## 数据与手机排障记录

warnings按人物来源读取；interpretation_scope定义当前证据范围，不改命盘事实。引擎不主动上传生辰，但聊天和context可能发送给所选模型供应商；规范输入仍在chart中，stdin无中间文件不等于无资料留存。报告只在明确要求时保存。

手机复核记录当前包名、设备／Rootfs、Node／ICU／时区版本、所用模型和实际工具状态；不上传真实生辰或私密关系作日志。桌面回归、解包验收、历史用户确认与当前手机实测分开，以当前验收记录为准，不编造设备日志。
