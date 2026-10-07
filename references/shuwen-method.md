# 疏文、表文与祭告文制作

用户要求写烧纸时用的疏文、表文，或祈福、祭祖、祭亡、还愿、忏悔等文稿时使用本模块。无需八字、紫微或卜卦。程序负责字段、日期换算和导出；AI 负责按用户心意、关系称呼与地方习惯拟写正文。默认先在聊天中给可复制的文稿，只有要求保存、下载或打印文件时才导出。

## 用途与信息

支持 `peace` 祈福平安、`ancestor` 祭祖追思、`memorial` 祭亡告慰、`thanks` 还愿答谢、`repentance` 忏悔省过、`wealth` 求财祈愿、`custom` 通用呈告。`form` 可选 `shuwen` 疏文、`biaowen` 表文、`jiwen` 祭文；称呼与标题依本次习惯，不把三者说成所有仪式中的同一种文书。`style` 默认为 `classical` 简洁文言，也支持 `plain` 白话。

先复用已知用途、落款姓名、呈告对象、日期和想表达的事。信息不足时合并询问：“这份是祭祖、祭亡，还是向神明祈愿？把落款姓名、对象称呼、使用日期和想说的话告诉我，有家乡固定格式也可以直接贴来。”仅问所缺项；不要为了写一份祭告文索要出生时辰、身份证号、住址门牌或逝者死因。

祭祖可用“历代祖先”；祭亡采用用户给出的“先父”“先母”等称呼或姓名，不自行推定关系、性别、忌日、死亡情况。向神明呈告时采用用户明确给出的神号或宫庙称谓，不自动塞入另一信仰的神名、佛号或咒语。具文人默认中性称谓；“信士”“信女”“孝男”等由用户格式和实际信息决定。生辰、居所、供物、承诺均为可选；供物只写用户实际打算陈设的内容。

缺失信息可以先出草稿。程序用显式待填项列出姓名、日期、呈告对象等缺项；不要把草稿说成已经填写完整。用户提供完整文稿时按原意润色，地域或宫庙给定格式优先，程序的通用段落只是可改写的结构。

## 内容与来源

通常由标题、呈告对象、具文人、事由、心意或祈愿、承诺（如有）、收束、落款与日期组成。按用途调整：祭祖祭亡侧重追思与告慰，还愿侧重答谢和践诺，忏悔侧重具体省过；不把每一种用途都套进求财模板。AI 可用 `body_text` 写本次原创正文，`petition` 写具体心愿，`commitment` 写用户实际愿意做的事。

原典与学术资料见 [疏文来源卡](knowledge/curated/cards/kb-shuwen-writing.md)。本包模板为原创整理，不假称出自某部古籍的逐字法本，不冒署道士法号、箓职、宫庙印信或虚构代奏人。佛教回向、道教上表及家族追思依其各自对象和语境写，不拼接成万能仪轨。普通对话和成稿不附固定免责段落，来源说明在用户要求或核对格式时提供。

## 输入

```json
{
  "mode":"shuwen",
  "purpose":"ancestor",
  "form":"biaowen",
  "style":"classical",
  "applicants":[{"name":"示例甲","role":"后人"}],
  "recipient":"历代祖先",
  "occasion":"家祭追思",
  "petition":"愿家人相亲相助，珍重身体，勤勉持家。",
  "date":{"calendar":"solar","date":"2026-10-05","display":"both"}
}
```

顶层可选 `title`、`recipient`、`occasion`、`offerings`、`petition`、`commitment`、`body_text`。`applicants` 为 1–20 人，每项可填 `name`、`role`、`birth_text`、`residence`。祭亡的 `subject` 可填 `name`、`relationship`、`death_text`；最后一项仅用户主动需要写时采用。

`date` 用 `{calendar:"solar"|"lunar",date:"YYYY-MM-DD",is_leap_month:false,display:"solar"|"lunar"|"both"}`；日期换算支持 1900–2100，农历闰月须显式注明，非法日期拒绝。输出农历年以农历年界计算，不套用八字立春年。地方传统日期或纪年可用 `{calendar:"text",text:"用户提供的日期文字"}` 原样保留，这种日期不会假称已程序换算。“今天”先核对客户端当地日期，再填写；程序不自行以运行服务器的时间补日期。

## 手机执行与保存

```sh
sh /skills/bazi-ziwei/scripts/mobile.sh --shuwen --stdin --bounded <<'SHUWEN_JSON'
{"mode":"shuwen","purpose":"ancestor","form":"biaowen","applicants":[{"name":"示例甲"}],"date":{"calendar":"solar","date":"2026-10-05"}}
SHUWEN_JSON
```

检查 exitCode=0、timedOut=false、truncated不为true，再解析stdout并检查ok=true。按返回的 `text` 给文稿，同时核对 `missing_fields`。不把程序JSON全贴给用户，不生成 `input.json`、`chart.json`、`report.md`、`report.html`。

`--bounded` 返回 suanming-shuwen-context/v1，整响应≤12KiB、完整shell包装<28KiB。`text_page`含total_chars、offset、returned_chars、next_offset（UTF-16位置）；默认chars=1800，可用--chars 200..3000。next_offset非空时仍有正文未读，直接执行next_actions中的完整argv，并把**同一原始JSON**送回stdin；不凭摘要续写，不把当前页说成全文。核对document_sha256相同后合并各页text，Unicode字符不拆开。

续页不重复--out、不重建已存在导出文件，也不指向已清理临时输入；无需自动保存原始JSON。长稿可按用户需要分段展示，或明确请求时导出完整文件。`--bounded`只改变stdout投影，不改日期、模板、完整text/parts或TXT/HTML内容；不带该参数的旧CLI仍保留完整输出，可能超过RikkaHub工具容量，不作日常入口。

明确需要文件时，给上述命令增加 `--out /workspace/bazi-ziwei-reports/TASK/document --format both --layout vertical`。`format` 支持 txt、html、both；HTML 支持横排和从右向左的竖排，多页自动分列，打印不加载网络字体或脚本。文字默认导出 `shuwen.txt`，HTML 为 `shuwen.html`；竖排只用于 HTML。导出为可用文稿文件，不额外保存输入 JSON。已有同名输出时使用新的任务目录，避免覆盖旧稿。

必须用输入文件时，采用 `--shuwen --temp-input PATH --bounded`，成功与异常均清理；用户明确要保留时才用 `--input`。不要将 `shuwen.txt`、`shuwen.html` 标为临时输入；详见 [输入生命周期](input-lifecycle.md)。改稿直接复用聊天中的已给信息，保存新版时仍须有用户要保存的意图。

用户随后询问烧纸、焚香或仪式顺序时，另按实际地域、仪式和已有来源回答；生成文稿不等于已代为呈递或举行仪式，也不自动安排收费法事或对外提交。
