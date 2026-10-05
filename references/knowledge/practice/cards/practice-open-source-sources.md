# 修行资料的开源检索入口与引用方法

编号：PR-12。内容身份：project_reference_guide。

## 已核项目入口

tao-kb用于道教典籍、来源目录及章节整理；fojin用于佛典检索与经注核对流程；Bilara提供稳定段落ID和发布元数据；kanseki-corpus提供汉译密教的纯文本入口；84000 translation-memory提供藏英对齐数据。这里介绍用途，本包不安装这些服务器，也未导入其全集。

## 本技能的引用规则

原典卡记录书名、经号或卷次、段落定位、来源链接及查核方式。正文、注释、现代学术摘要和本项目建议标清身份。需要逐字核对时先读卡片的原始链接，比较实际篇章；检索摘要不能代替影像校勘。

代码许可与文本许可分别查；MIT代码仓库不能让来源不明的全文自动获得MIT授权。动态网页打不开时，可用官方原始数据中的稳定经号或段落ID；无法核到的内容明确留作待核，不以AI摘要补充原文。新增资料仍按问答所需精选，保持手机包轻量。

## 来源与取用

- [LingTian/tao-kb](https://github.com/LingTian/tao-kb)，项目维护者；定位：README：原文、章节、sources.json、审计与待核目录。查核方式：project_documentation。
- [xr843/fojin](https://github.com/xr843/fojin)，项目维护者；定位：README；skills/sutra-commentary/SKILL.md。查核方式：project_documentation。
- [suttacentral/bilara-data](https://github.com/suttacentral/bilara-data)，SuttaCentral；定位：README：segment ID、Publication、published分支。查核方式：project_documentation。
- [tokushige-koyasan/kanseki-corpus](https://github.com/tokushige-koyasan/kanseki-corpus)，项目维护者；定位：README：CBETA XML来源、页栏标记、校勘省略说明。查核方式：project_documentation。
- [84000/data-translation-memory](https://github.com/84000/data-translation-memory)，84000；定位：README：Copyright Declaration。查核方式：project_documentation。

检索日期：2026-10-05。本卡正文为原创整理；来源的事实、古籍主张和本项目行动建议分别标明。
