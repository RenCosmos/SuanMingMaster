# 第三方依赖与参考

本技能的调度、输入校验、规则计算、账本、报告和技能指令为本次原创实现。没有复制 HeiGe-SuanMing 的非商业许可代码或文案。

| 库 | 固定版本 | 许可 | 上游 |
| --- | --- | --- | --- |
| lunar-typescript | 1.8.6 | MIT | https://github.com/6tail/lunar-typescript |
| iztro | 2.6.1 | MIT | https://github.com/SylarLong/iztro |
| @js-temporal/polyfill | 0.5.1 | ISC | https://github.com/js-temporal/temporal-polyfill |

传递依赖 lunar-lite、dayjs、i18next、@babel/runtime 为 MIT，jsbi 为 Apache-2.0；精确版本与包校验摘要见锁文件。每个包的原始许可证、版权声明随 `node_modules` 一同保留，不将本项目许可证替代第三方许可证。

测试中的少量预期值参考上游公开测试，不是重新实现底层历法或安星算法的证据。八字权重及结构规则是本项目显式定义的第一版模型，不能归因给第三方库或宣称为统一传统标准。

## 新增外部知识库：supe888/bazi_skills

来源：https://github.com/supe888/bazi_skills ，固定提交 f14a60b6192192d9472a6eb430cbae54a7cc50af。许可证 Apache-2.0；完整许可证保留于 `references/knowledge/supe888-bazi-skills/LICENSE-Apache-2.0.txt`。

35 个主题基于公开 `web/backend/prompts_zh_dump.json` 的 prompt/template 字段整理。本包对中文提示词 JSON、主题 Markdown 与 README 参考副本作本地改编，修改范围见本文件 0.5.1 说明。原始来源字节摘要与当前改编文件摘要分别记录在 manifest.json；元数据和 Apache-2.0 许可保持原样。

没有导入不存在的 `.cursor/skills/suanming` 目录，也没有复制 Web 前端、服务端、二进制工具或缓存。上述 Apache-2.0 材料不受本项目 MIT 许可证替代。

## 新增六爻数据参考：bopo/najia

来源：https://github.com/bopo/najia ，固定提交 9cf119169d7eb8e48febc05274aebf3f7106d647。许可证 MIT；版权声明 Copyright (c) 2019, najia，完整许可保留于 `references/third-party/najia/LICENSE-MIT.txt`。

本项目把 `najia/const.py` 的 64 卦名、八卦、纳甲、五行、六神数据转为 JSON，新增版本、来源、八宫变爻掩码、阶段名和世爻表。原始 const.py 按字节保留于 `upstream-const.py.txt`，转写数据为 `references/divination-tables.json`。未执行或打包该项目的 Python 程序。

六爻 JavaScript 调度、日期校验、动变与关系账本为本项目实现；进退神等机械配对规则按本项目说明采用，不将全部规则归因于该常量表。少量固定测试预期参考其公开测试。测试验证固定案例、装卦常量与规则一致性。

## 关系特征与民俗来源卡（v3）

桃花地支表取自 1liye/bazi-chart 的 bazi.html，固定提交 df008acfa31a79af0ff31612f4dfe20e38e0f715，MIT，Copyright (c) 2026 1liye；完整许可保留于 references/third-party/bazi-chart/LICENSE-MIT.txt，原文件和许可摘要见同目录 provenance.json。原表移入 relationship-rules.json，增加本包版本与来源元数据，表值未修改。未复制整份 HTML 或其中匹配评分。

xuemian168/bazi-skill 的 Apache-2.0 合盘说明仅作设计参考，未复制其原文或代码。ruanxiaoer888/bazi-engine 的 CC BY-NC-SA 4.0 知识数据未打包。

21 张民俗来源卡为本项目原创摘要与引用信息，其中新增 14 张古籍卡含已核短原文。官方非遗网页保持其原有权利，未收录网页全文；古籍采用古代中文短引文与原创主题摘要，未复制现代译注。不能把本包 MIT 许可扩展到这些来源网页。具体取用范围、查核方式与限制见 references/folklore-index.md。

## v5 对象画像与年龄取象

partner-image-rules.json 的标签、组合权重与柱位年龄模型为本项目原创整理，引用来源见其 sources。iztro 现代文档仅参考主题并作简要原创归纳；古代相法转录仅用形貌意象，不收录寿夭、贞节或贵贱断语，未复制现代网页全文。CTP 转录按搜索索引文本查核，未作影像校勘。年/月/日/时年龄取象明确标为本项目模型，不冒充某个古籍、官方名录或开源项目的已验证公式。现代页面权利不受本项目 MIT 许可替代。

## 0.5.1 知识文本改编

本包已修改 supe888/bazi_skills 的中文提示词、报告结构及 README 参考副本，清理固定免责声明、免责结尾和重复格式要求。原始提交与原始字节摘要记录在知识 manifest，当前改编文件另有随包摘要；主题数量和术数内容保留。Apache-2.0 许可证文本保持原样。

## V6.1 真太阳时与理论参考

NOAA Meeus 太阳位置公式以本项目 JavaScript 重新实现；2412 个月度均时差与 18 个地点向量通过原始 main.js 数学函数生成，原始下载摘要保留于 references/verification/noaa-solar-fixtures.json，未打包网页/UI 代码。

mengke-wang/xuziping-bazi（MIT，e7f94293df2f10288a9c8154e998f3610f5a27f8）的藏干集合与 100 项十神输出用作测试参考，保留原许可证 references/third-party/xuziping-bazi/LICENSE-MIT.txt；未复制其完整 Python 引擎。zhiji-bazi（Apache-2.0）仅参考日界和干支思路，无代码移植。shuishi-bazi 未见许可，仅阅读比较，不打包其代码或数据。sxtwl 2.0.7（BSD-3-Clause）仅在开发环境生成四柱和节气数值，手机包不包含其程序或 C++/Python 运行时。详细提交、采用范围、原典查核和版本区别见 references/bazi-theory-audit.md。

## V6.1 古籍知识增补

新增引用《礼记》《荆楚岁时记》《汉书》《抱朴子》《备急千金要方》《性命圭旨》《悟真篇》《太上老君说常清静经》《庄子》的古代中文片段。转录入口为维基文库、中国哲学书电子化计划和国学3000；保留篇章、检索定位、访问方式及所见修订链接。古代原文、网站数据编排与现代解释的权利分别处理，不对来源网站整体宣称公有领域或 MIT。

林富士《略论早期道教与房中术的关系》及《唐代医书的房中思想——以孙思邈〈备急千金要方·房中补益〉为研究主轴》的公开学术索引用于书目和引文交叉核对，仅保留链接与原创说明；未打包论文全文、现代译注或图像。逐卡来源与采用方式见 references/folklore/catalog.json、references/folklore/classical-verification.json。

## V6.2.0 年度关系修复

新增 bazi-period-relations.cjs 为本项目原创代码（MIT），年度与目标日期复用原有合冲刑害规则；未引入新的计算依赖。关系来源及三字组合状态由原局和所选流年逐项计算；不新增成化、概率或事件裁定。三合分类文献入口为《三命通会·卷二》，具体采用范围见 references/annual-relations.md。原 56 主题的知识文本与内容 SHA-256 保留。

## V1.1.1 三项目参考与精选资料

- jinchenma94/bazi-skill，提交 112a5d84cd1a001a0038cafca3be68d93e4c0cc9，MIT，Copyright (c) 2025 jinchenma94。完整许可见 references/third-party/jinchenma94-bazi-skill/LICENSE-MIT.txt。
- Renhuai123/ziwei-doushu，提交 79421c22501501eac783eeab52a7b485f9a2ed31，MIT，Copyright (c) 2026 紫微研究。完整许可见 references/third-party/Renhuai123-ziwei-doushu/LICENSE-MIT.txt。十干四化表作为独立核对向量保存在 references/verification/ziwei-flying-table.json。
- xuemian168/bazi-skill，提交 9c6b74c743c9ff46a2af8d786fb1cc8651804d5d，Apache-2.0，完整许可及 NOTICE 见 references/third-party/xuemian168-bazi-skill/。本版以原创卡片归纳分析方法和合盘组织方式，未复制整套 corpus 或模型调用流程。

6 张方法卡为本项目原创摘要，逐条标明固定提交、来源文件和项目许可；3 张《滴天髓》卡使用已核古代短引文与原创白话，没有复制现代译注。具体来源、采用范围、源文件及许可摘要见 references/project-adoption.md 和 references/knowledge/curated/catalog.json。新程序为本项目原创实现，仍使用既有固定计算依赖；没有打包上游课程、收费资料、个人命例库或大体积样本集。

## V1.1.6 修行与桃花转运资料

18张新增卡是本项目原创书目、摘要、阅读方法及行动建议，逐条保留22个来源入口、机构、篇章、查核方式和采用范围，见references/knowledge/practice/catalog.json。原有67主题及其许可证、目录和字节摘要不改动。

《医心方》影像目录只作版本线索，未打包扫描；林富士论文、政府辞条及宫庙/佛教机构说明仅作原创简要归纳与外链，不复制全文、图片、模板或网页代码。古代短句均标原典，不复制现代译注。现代行动方案不倒署为古籍或寺院原法。

CBETA的T1915、T0366、T0848只作经号、页栏定位与古代短引的查核来源，没有再分发XML、现代译文、校勘数据或整库。CBETA电子版及其数据编排适用自身版权声明（https://cbeta.org/copyright），含非商业及相同方式分享条件；本项目MIT许可不取代其权利。

SuttaCentral Bilara发布译文使用CC0，本包没有复制MN10英译全文，只保留稳定段落ID与原创中文归纳。84000 Toh437所见译本为CC BY-NC-ND 4.0，translation-memory仓库为CC BY-NC-ND 3.0；均未导入、翻译或改作其译文、仪轨及语料。

tao-kb代码MIT，fojin代码Apache-2.0；各自文本许可另核。kanseki-corpus为CC BY-NC-SA 4.0。本包只介绍这些检索与整理入口，没有移植代码、知识图谱、MCP服务器或大语料全集。

## V1.2.4宗教知识增补

新增8张原创宗教资料卡及7个来源记录，见references/knowledge/spirit/catalog.json。原85主题及103份已冻结知识、来源、查核和许可文件不改动。

CBETA T0262、T0412只用于篇章定位、两处古代短句查核和原创归纳，不导入XML、现代注释、完整咒语或仪轨。数字版适用https://cbeta.org/copyright的声明，包括CC BY-NC-SA 4.0及相关条件；项目MIT许可不取代来源权利。

SuttaCentral AN4.55、SN15.14的Bhikkhu Sujato发布译文采用CC0，本批只收经号、段落ID与原创中文归纳。中央研究院网站上的丁仁杰论文、台湾内政部文化说明及台湾文献馆冥婚研究摘要，仅作简要原创整理与外链，不复制现代论文、网页、图片或扫描。冥婚卡查核限于官方摘要的搜索索引，未冒称已读全文。
# Node运行环境

标准安装ZIP不附Node二进制。联网安装器从Node.js官方站下载v22.23.3，保留完整归档内的LICENSE，校验固定SHA后安装到工作区私有目录。Node、ICU及系统时区数据属于运行环境，不是命理规则；原435份计算依赖及其许可仍随安装包完整提供。
