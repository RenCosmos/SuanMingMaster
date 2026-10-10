# 输出预算与指引分工

维护查核资料；普通运行以[SKILL.md](../SKILL.md)为准，续页见[分页契约](pagination-guide.md)。不在本页混写历史版本测试数量或要求模型读完整记录。

| 输出 | 整响应UTF-8上限 | 完整shell包装 |
| --- | --- | --- |
| 排盘、关系、时辰、六爻、候选工作流 | 20KiB | <28KiB |
| 知识窗口、--bounded疏文 | 12KiB | <28KiB |

output-budget统一计入exitCode、stdout（含换行及JSON转义）、stderr、timedOut和最终清理／导航字段；投影预留后再次核对，通过才发布。超量减小分页或返回context_budget_exceeded，不切割JSON、不吞错误，完整原盘及文稿保留。

疏文用--bounded，按text_page和完整argv续读；同一JSON、同一document_sha256可还原全文。续页不重复--out，完整TXT／HTML导出不减少。--engine、--knowledge-full、未加--bounded的制文和手工整文件读取不在本保护层，不用于日常小型返回。

主Skill集中通用决策；专题页只定义输入、证据和本模式特例；可选系统提示词只补充口吻。历史反馈与发布审计留作维护，不加入日常指令链；知识正文及程序返回的规则、来源、警告不裁剪。

tests/output-budget.test.cjs仍检查完整包装、Unicode和转义边界、长路径、全部主题与候选分页、临时清理、长疏文还原与完整导出；正式结果见当前release-validation.json。消息截断与计算等待的官方出处见[RikkaHub适配](rikkahub-adaptation.md)，不把程序预算当作所有模型的回复长度保证。
