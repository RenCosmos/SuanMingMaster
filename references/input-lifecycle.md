# 输入与结果生命周期 · V1.2.0

优先使用带引号 here-document 将合法 JSON 送入 mobile.sh --stdin --out TASK --focus 主题。同次计算校验后只读 stdout.context，无需 input.json、独立 verify 或 cat 完整 JSON。

知识检索直接 --knowledge --query 关键词 --limit 3；正文 --topic SLUG --chars 1800，按 next_offset 继续。不创建 knowledge-query*.json。

必须用文件时 --temp-input PATH 须是输入选项的第一项，Node finally 和 shell trap 在成功、计算错误或可捕获退出时清理本次普通文件。--input 明确保留文件。清理不扫描其他目录，不删技能资源、符号链接或执行期间被替换的文件；发生变化时保留并报 cleanup_error。新增 context.json、brief.json、validation.json 与原报告/计算文件均受防误删保护。

工作区任务保留 chart.json、context.json、validation.json，用于后续 --reuse。新流程的时辰对照不另生成 comparison.json，大候选数据存在 chart。原 --engine 接口仍可生成 comparison.json。只有明确 --report 或 --render 才导出报告；用户明确保存解读才写 reading.md。

原子写入使用同目录 .tmp 随机名，正常或异常均 finally 清理；突然断电或 SIGKILL 无法执行清理，残余 .tmp 不用于缓存。用户输入和背景不写入技能、提示词、知识库或合成测试。匿名任务目录不含姓名、生日。
