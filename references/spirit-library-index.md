# 鬼神、护法与宿缘：宗教资料索引

2026-10-06补充8张卡、7个来源，合计93个主题，随V1.2.4安装包提供。原有85主题及其来源正文、目录和字节摘要保持不变；V1.2.3安装ZIP仍保留原85主题版本。

仅收宗教经典及相关宗教文化、祭祀研究。资料身份分为宗教教义、特定地区的习俗研究、官方文化说明；这三类不能互相代替。目录与查核记录见[catalog.json](knowledge/spirit/catalog.json)。

## 按问题取用

| 问题 | 卡片 | 已核依据与范围 |
| --- | --- | --- |
| 人和鬼、神与祖先是什么关系 | [神鬼祖先分类](knowledge/spirit/cards/spirit-human-ghosts.md) | 丁仁杰论文相关段落，限宗教象征与社会关系分析 |
| 撞鬼会怎样，鬼一定害人吗 | [遇鬼与鬼王](knowledge/spirit/cards/spirit-dizang-ghost-kings.md) | 《地藏经》第八品，不是现实事件预测表 |
| 什么是护法，鬼子母为什么也护法 | [佛教护持](knowledge/spirit/cards/spirit-buddhist-protectors.md) | 《法华经》卷七陀罗尼品，不认证个人护法身份 |
| 轮回、宿世亲缘、前世是谁 | [轮回与亲缘](knowledge/spirit/cards/spirit-rebirth-kinship.md) | SN15.14，保留劝修目的；未考证冤亲债主术语起源 |
| 前世姻缘、来世还能相见吗 | [来世夫妻](knowledge/spirit/cards/spirit-marriage-future-life.md) | AN4.55信、戒、施、慧；不是前世配偶识别术 |
| 为亡者修福、追荐、存亡关系 | [利益存亡](knowledge/spirit/cards/spirit-dizang-memorial.md) | 《地藏经》第七品；不量化功德或个人亡者处境 |
| 中元普度、孤魂、好兄弟、大士爷 | [中元与普度](knowledge/spirit/cards/spirit-zhongyuan-pudu.md) | 台湾内政部宗教及礼制司官方说明，保留地方差异 |
| 冥婚、人鬼婚姻、祭祀归属 | [冥婚研究](knowledge/spirit/cards/spirit-ghost-marriage.md) | 台湾文献馆的兰阳研究摘要；未读取论文全文 |

## 使用与核对

纯宗教或文献提问无需生辰、性别或排盘。沿用原有检索接口：

```sh
node scripts/knowledge-context.cjs --query '前世姻缘有没有经典依据' --limit 3
node scripts/knowledge-context.cjs --topic spirit-marriage-future-life --chars 1800
node scripts/knowledge.cjs --verify
```

移动端沿用`mobile.sh --knowledge`。搜索结果与正文分页保留`source_kind`、来源链接；新卡额外返回`tradition`、`evidence_scope`、`locator`、`access_method`及`inference_limits`，让简短上下文也保留出处身份和推断范围。卡片正文仍可分页完整读取。

介绍宗教信仰时，先沿用户采用的传统回答所问，再自然交代书名或出处；可以用“按佛教的讲法”“民间这里讲的是”等归属语，不必每句重复“只是叙事”。汉传经文、巴利经文、台湾民俗及其佛道融合分别标清，不拼成统一鬼神谱系。

不主动争论鬼神有无，不把宗教提问改成劝信科学、破除迷信或医学科普，也不把用户的信仰当作需要纠正的问题。用户明确询问不同解释或证据时，才按其所问比较；资料注明未核全文、研究范围或不能据此识别个人身份，是内部核对限制，不是回答的固定开场、结尾或逐条告诫。普通教义、仪式文化和宿缘问答直接展开内容。

用户讲个人经历时，可以讨论对应传统的含义、个人信仰解释与文本依据；不要凭命盘、梦境、感应或熟悉感替他确认附身、鬼魂索债、特定护法或前世配偶，也不编造通灵感应。六爻官鬼、游魂、归魂按术语解释，不改写成个人鬼魂身份，宗教解释不写入排盘计算结果。仅当用户要求确定个人身份、保证免灾治病，或涉及伤害、胁迫、骗财等具体风险时，简短说明该问题的限制并给安全建议；这不代表对鬼神有无作结论。

## 查核深度和版权

CBETA两部经文核到TEI转录与页栏行号，未作影像校勘；只收两处短古文、定位及原创归纳，不导入XML、咒语或仪轨。数字版的[使用声明](https://cbeta.org/copyright)不被项目MIT许可替代。

SuttaCentral核到AN4.55、SN15.14的published段落JSON和[CC0许可](https://github.com/suttacentral/bilara-data/blob/published/LICENSE.md)。卡内中文是项目归纳，不是假造古代汉译原句。

丁仁杰论文核到相关页文字层；冥婚卡仅核到搜索索引中的官方摘要。不会把摘要包装成全文研究，也不导入现代论文、扫描、图片或现代长译注。逐源日期、采用范围和查核限制均在目录中。尚未纳入完整道教护法谱系、藏传护法传承和“冤亲债主”术语史，不声称这批卡已覆盖全部宗教传统。
