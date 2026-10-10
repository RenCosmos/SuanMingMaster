# 修行与桃花、转运知识索引

本组18张卡、22个来源入口，是当前107主题的一部分；来源身份、篇章、查核方式、采用范围及SHA-256见[目录](knowledge/practice/catalog.json)。保存原创整理和少量古代短引，不声称导入整部道藏、佛藏、论文或现代译本。

| 编号 | 主题 | 内容身份 |
| --- | --- | --- |
| PR-01 | [房中秘术与《医心方》书目](knowledge/practice/cards/practice-fangzhong-bibliography.md) | 版本、书目与研究入口 |
| PR-02 | [房中术与早期道教](knowledge/practice/cards/practice-fangzhong-scholarship.md) | 学术机构论文摘要的原创归纳 |
| PR-03 | [坐忘、收心与简事](knowledge/practice/cards/practice-dao-zuowang.md) | 古代短引及当代入门建议 |
| PR-04 | [修仙与内丹阅读](knowledge/practice/cards/practice-dao-neidan-guide.md) | 原创阅读方法与项目入口 |
| PR-05 | [积善与功过观](knowledge/practice/cards/practice-dao-good-deeds.md) | 古代短引及当代实践建议 |
| PR-06 | [佛教止观](knowledge/practice/cards/practice-buddhist-zhiguan.md) | T1915经号、页栏与原创说明 |
| PR-07 | [四念处](knowledge/practice/cards/practice-buddhist-mindfulness.md) | MN10稳定段落及原创归纳 |
| PR-08 | [念佛与净土入门](knowledge/practice/cards/practice-buddhist-amitabha.md) | T0366定位与当代入门建议 |
| PR-09 | [发愿、省过与善行](knowledge/practice/cards/practice-buddhist-daily-vow.md) | 当代佛教机构说明及原创安排 |
| PR-10 | [汉译密教与《大日经》](knowledge/practice/cards/practice-esoteric-dainichi.md) | T0848古代短引及阅读方法 |
| PR-11 | [藏传密续、灌顶与作明佛母](knowledge/practice/cards/practice-vajrayana-context.md) | 译本书目与宗教语境 |
| PR-12 | [开源资料入口](knowledge/practice/cards/practice-open-source-sources.md) | 项目功能、引用和采用范围 |
| PR-13 | [月老、红线与求姻缘](knowledge/practice/cards/practice-romance-yuelao.md) | 官方辞条、地方记录及原创愿词 |
| PR-14 | [八字紫微看桃花](knowledge/practice/cards/practice-romance-chart.md) | 咸池原典规则与已运行程序的取用方法 |
| PR-15 | [提升恋爱机会](knowledge/practice/cards/practice-romance-actions.md) | 当代原创行动建议 |
| PR-16 | [《了凡四训》与改善运气](knowledge/practice/cards/practice-luck-liaofan.md) | 古代短引及当代实践建议 |
| PR-17 | [祈福、安太岁与光明灯](knowledge/practice/cards/practice-luck-temple.md) | 地方民俗及寺院说明 |
| PR-18 | [工作、财务、人际与环境改善](knowledge/practice/cards/practice-luck-actions.md) | 当代原创行动建议 |

使用[民俗与修行方法](folk-cultivation-method.md)回答文献问题；使用[桃花与转运方法](luck-practice-method.md)处理“怎么办”。不用把所有卡载入上下文。

```sh
sh /skills/bazi-ziwei/scripts/mobile.sh --knowledge --query '如何增加桃花' --limit 3
sh /skills/bazi-ziwei/scripts/mobile.sh --knowledge --query '最近一直倒霉怎么办' --limit 3
sh /skills/bazi-ziwei/scripts/mobile.sh --knowledge --topic practice-vajrayana-context
```

查询直接传参，不产生knowledge-query.json。词句检索先返回卡片入口，需要细节时再用topic取全文。普通答复说书名、机构或原始链接；用户要核对时再给PR编号和定位。
