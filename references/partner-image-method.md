# 单人对象形象与年上／年下

> V1.2.0 日常执行以 SKILL.md 的 workflow 为准：同次计算校验，直接读主题 context，追问用 --reuse。本页保留的 run.cjs / --verify / 完整 JSON 示例用于维护核对，无需逐次执行；计算口径与规则仍适用。


## 任务与输入

用户问另一半长相、体态、气质、穿着风格、属相缘分，或未来对象偏年上还是年下时，用 relationship 模式，people 只需本人一项，id 为 a。不询问未来对象的出生资料。chart_mode 默认 both；年龄以有出处的紫微夫妻宫婚配文字取象，八字柱位作辅助。仅紫微也可运行，详见 [单人年龄方法](partner-age-method.md)。

context.topics 加 partner_image；只问属相可加 zodiac；年上/年下加 age_relation。模型选项为 auto / all / wealth / authority。默认 auto 按传统算法 gender 参数选择主线：male 取财星、female 取官杀。显式指定模型时优先采用用户选择；all 将财星与官杀分别计算，保留分歧。

```json
{
  "mode":"relationship",
  "question":"我的情感对象大概是什么形象，偏年上还是年下？",
  "chart_mode":"both",
  "people":[{"id":"a","birth":{"calendar":"solar","date":"1995-01-15","time":"09:30","gender":"female","timezone":"Asia/Shanghai"}}],
  "context":{"stage":"single","topics":["partner_image","age_relation","zodiac"]},
  "options":{"partner_star_model":"auto"}
}
```

默认在对话中回答，仍只保存计算 JSON；用户要求报告时才导出文件。

## 单人年龄取象

读取 age_relation.predictions 中本人 R-A-AGE 的 tendency、basis、status 与 ziwei.matches。夫妻宫规则附实际宫位、适用性别与原典；明确的组合条件覆盖通则，其他冲突保留 mixed。辅星和空宫对宫只作旁证。没有明确规则时保留 none，不拿星曜成熟感换算实际年龄。

八字 models 分别保留财星与官杀的柱位辅助账本，position_tendency 和 position_weights 不决定最终年龄方向。all 的两条线索分别列出；切换财官模型只影响八字辅助，不改变紫微原文的夫、妻适用条件。八字星不显时不补造配偶星，不生成精确岁数差。

原典的“宜配”按传统婚配倾向表达；正常聊天先回答实际主规则支持的方向，再说明条件。只有八字辅助时直说年龄方向还不集中，补充财官柱位的辅助取象即可。来源与规则身份见 [年龄方法](partner-age-method.md)，不拿自述偏好覆盖程序结果。

双人合盘时每人各有一项独立年龄预测，但默认重点回答现实关系问题，不主动替用户比较生日再称为年上预测。

## 对象形象计算

partner_images 每人一个对象画像，由三个层次组成：

1. 八字：日支夫妻宫五行、本气十神，以及所选财/官杀候选五行与透藏；日支主线和配偶星作为两类依据。
2. 紫微：夫妻宫实际主星及亮度、四化；空主星宫保留为空，并以对宫实际主星作为较低权重辅助，三方四正作为进一步阅读背景。不将辅助星登记成本宫实际安星。
3. 属相：本人八字年支生肖；六合与三合给候选属相缘分线索，单独列出，不参与五官/体态标签排序。生肖不是唯一识别人选，也不反推具体出生年。

标签分 appearance（外形印象）、temperament（气质）、style（风格）。每条在 ledger 带 R-A-IMAGE-xxx、来源人物/编号、rule_id 与权重。标签排序权重是本版取象整理方式，不是准确率。AI 从标签与证据挑主线，写成连贯的人物描述；不要把所有标签逐字堆在一段里。

年支按八字立春换年；农历生肖另保留 lunar_new_year_animal。立春与春节之间可能不同，只在影响本次生肖解读时自然说明所用口径，不固定加一段提示。

画像描述外形轮廓、体态印象、气质及风格，使用“偏清秀”“更像利落干练的一类”“第一眼容易有……”等表达。五行、星曜与生肖不同方向时写成主次或反差，例如“外形柔和，做事却有主见”。不补造姓名、确切身高厘米、五官尺寸、照片相似度、族裔、籍贯或对象唯一属相。

## 口吻

具体节奏与合成示范见 [对话语气说明](conversation-style.md)。

先直接回答画像与年龄倾向，再用两三句连接关键盘面。普通聊天用自然语言说明关键柱位、宫位或星曜，用户要核对时再给实际编号。使用自然的聊天口吻，不添加固定免责声明、免责结尾或泛化说教。

用正常的倾向表达传达推演性质。线索相冲时具体说哪里不同；缺资料或计算失败时只说明当前缺失/错误及下一步，不为了流畅补盘。用户问资料出处或方法时再展开规则身份与来源。亲密专题按所问范围结合实际结构与背景展开。

## 来源与采用范围

星曜主题参考 [iztro 作者的十四主星说明](https://docs.iztro.com/learn/major-star)；传统形貌背景参考 [紫微斗数全书卷一转录](https://docs.iztro.com/zh_TW/learn/ancientBook-1)与 [CTP 相法转录](https://ctext.org/wiki.pl?chapter=665923&if=gb&remap=gb)。CTP 部分为搜索索引查核，未完成影像校勘。未收录寿夭、贞节、贵贱或病理断语。

配偶宫十神画像参考已固定提交的 1liye/bazi-chart，保留既有 MIT 许可；本版全部标签为原创简要归纳与中性改写，不复制现代网页全文或打包现代译注。形象来源见 partner-image-rules.json；年龄另见 [原典与规则表](partner-age-rules.json)，八字柱位仅为项目辅助。

## 时间不确定的画像

出生时间有范围或完全未知时先用 [时辰对照](time-compare-method.md)。共同画像取 comparison.image_tags 的 common 标签，变化部分按 varying 对应候选回查；年龄读取各候选的主线。不同候选的紫微夫妻宫、配偶星和时柱分开解释，不合成一张没有实际排出的盘。
