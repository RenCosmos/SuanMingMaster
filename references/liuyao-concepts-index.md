# 六爻基础概念

六张实质知识卡是当前107主题知识库的一部分。参考《增删卜易》已核对的原文转录，身份是项目概念归纳，不是古籍逐字全文、模型指令或自动占断。

| 问句与术语 | 对应知识卡 |
| --- | --- |
| 六爻用神怎么取、六爻取用神、六亲取用 | [六爻用神与取用](knowledge/liuyao-concepts/cards/liuyao-use-god.md) |
| 世爻应爻是什么、世应关系 | [世应与世爻应爻](knowledge/liuyao-concepts/cards/liuyao-shi-ying.md) |
| 原神／元神、忌神、仇神 | [原神忌神仇神](knowledge/liuyao-concepts/cards/liuyao-yuan-ji-chou.md) |
| 动爻变爻、老阴老阳、回头生克 | [动爻变爻](knowledge/liuyao-concepts/cards/liuyao-moving-changing.md) |
| 月建日辰、六爻旺衰 | [月建日辰](knowledge/liuyao-concepts/cards/liuyao-month-day.md) |
| 旬空与月破、空亡、出空填实 | [旬空月破](knowledge/liuyao-concepts/cards/liuyao-empty-broken.md) |

RikkaHub Workspace入口：`sh scripts/mobile.sh --knowledge --query '六爻用神怎么取' --limit 3`。需要正文时用返回的 `read.topic` 执行 `--knowledge --topic SLUG --chars 1800`，依 `next_offset` 续读；七类领域仍可显式选择，`--domain liuyao` 严格限定六爻。

无Workspace或Node时，直接用 `use_skill` 读本页和链接卡；无需生辰、起卦、临时查询文件或联网。这里只解释概念，不补造用户没有提供的铜钱记录。各卡全文均在安装资源目录中，来源、查核定位和SHA-256见[目录](knowledge/liuyao-concepts/catalog.json)。原有五份无运行时概览和97主题正文不删除、不替换。

术语与领域：完整术语优先；六爻语境的“用神／取用神”与八字喜用分开，裸词不自动选领域；“元神”不自动解释为六爻或宗教认证。已有具体术语时，“六爻”等领域词本身不再作为无关卡的命中依据。自动领域仍只参与排序，书名／篇名优先，跨领域问题不硬过滤。

能力边界：六亲、世应、日月、动变、旬空与月破结构由现有程序计算；取用、完整旺衰、生克有效性、吉凶及应期属于有条件的传统解读，不声称程序自动完成或验证现实结果。更多计算口径见[六爻方法](liuyao-method.md)。所有检索结果继续标记 `reference_material`、`untrusted_reference_text`、`instruction_authority: none`。

来源主例：[《增删卜易》用神章第八](https://zh.wikisource.org/zh-hans/增刪卜易/8)。2026-10-08核对网页古籍转录；其他章节逐卡列出。未作影印校勘，不把网页后人按语混作原文。
