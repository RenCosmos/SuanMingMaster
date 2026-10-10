# 三项目参考与增补

本页记录固定来源与采用范围，不是安装或运行指令。技能名bazi-ziwei，当前用法见[SKILL.md](../SKILL.md)，产品版本以package.json为准；来源提交不随产品号变化。

## 本步采用

| 参考项目与固定提交 | 阅读材料 | 本项目增补 |
| --- | --- | --- |
| [jinchenma94/bazi-skill](https://github.com/jinchenma94/bazi-skill/tree/112a5d84cd1a001a0038cafca3be68d93e4c0cc9)，MIT | classical-texts、wuxing-tables、dayun-rules、pai_pan | 经典阅读分工、十神透藏、运岁方法；大运补充藏干十神及对原局四柱/日支的关系 |
| [xuemian168/bazi-skill](https://github.com/xuemian168/bazi-skill/tree/9c6b74c743c9ff46a2af8d786fb1cc8651804d5d)，Apache-2.0 | analysis-methods、compatibility-analysis、classics/index | 计算事实与解释分层，格局/扶抑/调候按问题核对；双人来源与岁运对照；时辰摘要补逐年日支关系 |
| [Renhuai123/ziwei-doushu](https://github.com/Renhuai123/ziwei-doushu/tree/79421c22501501eac783eeab52a7b485f9a2ed31)，代码 MIT | sihua、constants、heming-knowledge、gusuifu | 宫干四化发出、落点与自化独立实现；婚恋关注宫位保留盘内飞化；时辰摘要比较夫妻宫飞化 |

获取及查核日期：2026-10-04。项目方法由本项目原创归纳，新增计算复用既有固定历法库与关系表。来源提交、所阅文件字节摘要与许可证摘要见 [精选目录](knowledge/curated/catalog.json)。完整许可见 references/third-party 下对应项目目录。

## 资料筛选

jinchenma94 的经典文件是现代知识摘要，部分取用简化、整数岁起运和藏干排序不与本包口径完全一致。本包保持既有分钟差起运、固定藏干次序与独立历法验证；项目摘要只作为阅读路由和解释方法。

xuemian168 的所见 classics/index 明确说明 corpus 为空、PROVENANCE 尚未落地；卡片主题及引用契约是方法设计，不能称为已经完整导入可逐字验证的古籍底库。这里只借鉴来源卡和适用前提的组织方式。

Renhuai123 的 gusuifu 数据包含“创业”“公职”等现代措辞和按星曜扩写的段落，当前不据它声称获得底本原文。heming 中的确定婚龄、年龄差和个别断语不进入本项目计算规则。现代《天纪》课程另有非商业许可，本手机包未收录课程文字、视频或现代讲义。大体积样本集留作以后专门评估，当前包使用精选卡片。

古籍条文另外查核 [《滴天髓》转录](https://zh.wikisource.org/wiki/滴天髓) 的月令论、岁运论、寒暖论。3 条短引文及章节在所见页面中匹配；保留访问日期、检索捕获摘要与本项目白话，未作影像底本校勘。条文出处与开源项目方法分别标明。

## 精选知识入口

以下九张方法卡及末尾两张年龄／制文卡构成11张精选；用query或topic读取。它们是当前107主题中的一个分组，不另称较小的总库。

| 卡片 | 入口 |
| --- | --- |
| 经典阅读分工 | [kb-nine-classics-guide](knowledge/curated/cards/kb-nine-classics-guide.md) |
| 十神、藏干与柱位 | [kb-ten-gods-hidden-position](knowledge/curated/cards/kb-ten-gods-hidden-position.md) |
| 大运、流年与原局 | [kb-dayun-natal-relations](knowledge/curated/cards/kb-dayun-natal-relations.md) |
| 格局、扶抑与调候 | [kb-analysis-lenses](knowledge/curated/cards/kb-analysis-lenses.md) |
| 单人婚恋与双人岁运 | [kb-relationship-timing](knowledge/curated/cards/kb-relationship-timing.md) |
| 宫干飞化、自化与落点 | [kb-ziwei-palace-flying](knowledge/curated/cards/kb-ziwei-palace-flying.md) |
| 《滴天髓》月令提纲 | [kb-classic-month-command](knowledge/curated/cards/kb-classic-month-command.md) |
| 《滴天髓》岁运战和 | [kb-classic-year-decade](knowledge/curated/cards/kb-classic-year-decade.md) |
| 《滴天髓》寒暖燥湿 | [kb-classic-cold-warm](knowledge/curated/cards/kb-classic-cold-warm.md) |

复杂问题根据需要分别核对月令格局、旺衰扶抑、寒暖调候，再用实际计算字段归纳。普通追问接着聊天，用户需要文件时才导出；不强制完整报告或多人会诊格式。出生资料继续只用于当前任务文件，开发与随包示例采用合成输入。

## 后续可独立完成的步骤

1. 原局＋大运＋流年的完整联合关系矩阵；精确交运区间已提供，不将它误列成未实现功能。
2. 已核原典的更多子平条文，以及有条件、有来源的格局候选规则。
3. 用户给定范围和现实约束下的择日择时计算。

这些项目当前仍属扩展方向；本版的可运行字段以 [大运与飞化方法](dayun-flying-method.md) 为准。

## 年龄原典修订

[年龄原典依据](knowledge/curated/cards/kb-partner-age-classics.md)基于另行核对的《紫微斗数全书》录文，不采用三个项目的年龄分数或确切岁差；现代线索另分层。见[单人年龄方法](partner-age-method.md)。

## 疏文制作

[文書來源卡](knowledge/curated/cards/kb-shuwen-writing.md)参考原典分类、成功大学文体研究和宫庙流程，模板原创，不复制现代法本或网站代码；执行见[疏文方法](shuwen-method.md)。
