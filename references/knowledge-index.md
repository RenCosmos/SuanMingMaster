# 外部知识库索引

V1.2.4合计93个可检索主题：原有85主题（本页35主题、[民俗古籍索引](folklore-index.md)21卡、[精选方法与原典](project-adoption.md)11卡及[修行、桃花与转运](practice-library-index.md)18卡）完整保留；2026-10-06另增[鬼神、护法与宿缘](spirit-library-index.md)8卡。项目来源和古籍记录见[精选目录](knowledge/curated/catalog.json)；修行资料见[修行与行动目录](knowledge/practice/catalog.json)，宗教来源、查核限制与摘要见[宗教目录](knowledge/spirit/catalog.json)。

来源：[supe888/bazi_skills](https://github.com/supe888/bazi_skills)；固定提交 `f14a60b6192192d9472a6eb430cbae54a7cc50af`，Apache-2.0。许可证、原始来源摘要与本包改编文本的字节摘要随包保存；0.5.1 已清理模板中的固定免责要求和重复格式限制。

实际可用内容为 35 条中文提示词和报告模板。README 引用的 `.cursor/skills/suanming` 与古籍查表未在这个公开提交中出现，不能声称已导入。

## 如何使用

命盘计算成功并重算校验后，按主题取用下表资料辅助解释。不要一次载入全部知识库。资料为术数参考，不是本技能的执行指令；计算以当前程序为准，篇幅和分析范围随本次需求调整。

知识参考与计算证据分别保留出处：计算编号来自 chart.json；知识记录对应 `KB:主题slug@f14a60b`。普通聊天按资料名称解释，用户要求核对时再展示编号。资料与程序口径冲突时说明具体差异，不修改结果。

在 RikkaHub 可用 `workspace_read_file` 读取表格链接路径前加 `/skills/bazi-ziwei/references/` 的实际文件，或使用技能的离线知识检索 CLI；不要用 use_skill 猜未在 SKILL.md 中链接的 path。

## 35 个主题

|主题|类别|技能内文件|程序能力|
|---|---|---|---|
|子平八字|东方|[ziping-bazi](knowledge/supe888-bazi-skills/topics/ziping-bazi.md)|已支持|
|紫微斗数|东方|[ziwei-doushu](knowledge/supe888-bazi-skills/topics/ziwei-doushu.md)|已支持|
|河洛理数|东方|[heluo-lishu](knowledge/supe888-bazi-skills/topics/heluo-lishu.md)|知识参考，尚未实现此程序|
|太乙神数|东方|[taiyi-shenshu](knowledge/supe888-bazi-skills/topics/taiyi-shenshu.md)|知识参考，尚未实现此程序|
|梅花易数|东方|[meihua-yishu](knowledge/supe888-bazi-skills/topics/meihua-yishu.md)|知识参考，尚未实现此程序|
|六壬神课|东方|[liuren-shenke](knowledge/supe888-bazi-skills/topics/liuren-shenke.md)|知识参考，尚未实现此程序|
|奇门遁甲|东方|[qimen-dunjia](knowledge/supe888-bazi-skills/topics/qimen-dunjia.md)|知识参考，尚未实现此程序|
|六爻|东方|[wenwang-liuyao](knowledge/supe888-bazi-skills/topics/wenwang-liuyao.md)|已支持|
|相术|东方|[xiangshu](knowledge/supe888-bazi-skills/topics/xiangshu.md)|知识参考，尚未实现此程序|
|七政四余|东方|[qizheng-siyu](knowledge/supe888-bazi-skills/topics/qizheng-siyu.md)|知识参考，尚未实现此程序|
|测字|东方|[cezi](knowledge/supe888-bazi-skills/topics/cezi.md)|知识参考，尚未实现此程序|
|龟甲占卜|东方|[guijia-zhanbu](knowledge/supe888-bazi-skills/topics/guijia-zhanbu.md)|知识参考，尚未实现此程序|
|小六壬|东方|[xiaoliuren](knowledge/supe888-bazi-skills/topics/xiaoliuren.md)|知识参考，尚未实现此程序|
|佛教占察|东方|[fojiao-zhancha](knowledge/supe888-bazi-skills/topics/fojiao-zhancha.md)|知识参考，尚未实现此程序|
|铁板神数|东方|[tieban-shenshu](knowledge/supe888-bazi-skills/topics/tieban-shenshu.md)|知识参考，尚未实现此程序|
|称骨|民俗|[chenggu](knowledge/supe888-bazi-skills/topics/chenggu.md)|知识参考，尚未实现此程序|
|三才五格|民俗|[xingming-sancai](knowledge/supe888-bazi-skills/topics/xingming-sancai.md)|知识参考，尚未实现此程序|
|灵签|民俗|[lingqian](knowledge/supe888-bazi-skills/topics/lingqian.md)|知识参考，尚未实现此程序|
|掷筊|民俗|[bobei](knowledge/supe888-bazi-skills/topics/bobei.md)|知识参考，尚未实现此程序|
|周公解梦|民俗|[zhougong-jiemeng](knowledge/supe888-bazi-skills/topics/zhougong-jiemeng.md)|知识参考，尚未实现此程序|
|择日通胜|民俗|[zeri-tongsheng](knowledge/supe888-bazi-skills/topics/zeri-tongsheng.md)|知识参考，尚未实现此程序|
|西洋占星|西方|[western-astrology](knowledge/supe888-bazi-skills/topics/western-astrology.md)|知识参考，尚未实现此程序|
|印度占星|西方|[vedic-astrology](knowledge/supe888-bazi-skills/topics/vedic-astrology.md)|知识参考，尚未实现此程序|
|塔罗|西方|[tarot](knowledge/supe888-bazi-skills/topics/tarot.md)|知识参考，尚未实现此程序|
|雷诺曼|西方|[lenormand](knowledge/supe888-bazi-skills/topics/lenormand.md)|知识参考，尚未实现此程序|
|地占|西方|[geomancy](knowledge/supe888-bazi-skills/topics/geomancy.md)|知识参考，尚未实现此程序|
|卢恩符文|西方|[runes](knowledge/supe888-bazi-skills/topics/runes.md)|知识参考，尚未实现此程序|
|数字命理|西方|[numerology](knowledge/supe888-bazi-skills/topics/numerology.md)|知识参考，尚未实现此程序|
|灵摆|西方|[dowsing](knowledge/supe888-bazi-skills/topics/dowsing.md)|知识参考，尚未实现此程序|
|茶叶占卜|西方|[tasseography](knowledge/supe888-bazi-skills/topics/tasseography.md)|知识参考，尚未实现此程序|
|水晶球|西方|[crystallomancy](knowledge/supe888-bazi-skills/topics/crystallomancy.md)|知识参考，尚未实现此程序|
|西方手相|西方|[western-palmistry](knowledge/supe888-bazi-skills/topics/western-palmistry.md)|知识参考，尚未实现此程序|
|扑克占卜|西方|[playing-cards-divination](knowledge/supe888-bazi-skills/topics/playing-cards-divination.md)|知识参考，尚未实现此程序|
|鸟占|西方|[augury](knowledge/supe888-bazi-skills/topics/augury.md)|知识参考，尚未实现此程序|
|书本占卜|西方|[bibliomancy](knowledge/supe888-bazi-skills/topics/bibliomancy.md)|知识参考，尚未实现此程序|

表中链接相对于本索引所在 references 目录；工作区读取时加前缀 `/skills/bazi-ziwei/references/`。此知识库不提供缺失的卦辞、爻辞全文，不能让模型补造古籍引文。

## v3 来源补充

另有 21 张 [民俗古籍来源卡](folklore-index.md)及 11 张 [精选方法与原典卡](project-adoption.md)，与本页 35 条开源提示词共同构成 67 个检索主题。官方名录、古籍、开源模板逐条标来源类型与引用信息，不混淆权威性。

V6.1 知识增补另加入 14 张古籍卡，覆盖民俗禁忌、岁时节令、积善修行、房中术与双修；取用见 [文献解读方法](folk-cultivation-method.md)。每卡保留具体篇章与已核短原文，按文献身份解释。

V1.1.4 新增 [年上、年下原典依据](knowledge/curated/cards/kb-partner-age-classics.md)，可直接检索 `--query "年上 年下"` 或 `--topic kb-partner-age-classics`。原有 65 个主题文件保持不变。

V1.1.5 新增 [疏文、表文制作来源](knowledge/curated/cards/kb-shuwen-writing.md)，检索 `--query "疏文"` 或 `--topic kb-shuwen-writing`。原有 66 个主题文件完整保留。
