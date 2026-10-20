# 八字专业细盘（程序计算）

用户问星运、自坐、旬空、胎命身、司令、小运或八字神煞时读取本页；一般事业、情感概况不默认增加调用。不手排或凭模型记忆补算。先有正常排盘结果，再使用其 files.chart 和 context.source_checksum：

只问术语含义时无需排盘，使用知识检索；传统说法与实际字段的对应见[24张释义索引](bazi-detail-index.md)。读到命中结果后也只按所问取用，不为了凑报告读取所有卡。

~~~sh
sh /skills/bazi-ziwei/scripts/mobile.sh --reuse /workspace/bazi-ziwei-reports/TASK/chart.json --page bazi-detail --base-checksum SHA
~~~

SHA 替换为原 context.source_checksum。双人关系盘加 --person a 或 b；未知时辰结果必须加明确 --candidate TC-...，只展示该候选，不代表全部时辰一致。紫微单盘、六爻、正缘候选搜索产物不是此入口的来源。按正常外层状态及 validation.ok 核对结果。

## 输出与继续读取

- reading.bazi_detail.natal：四柱显干／藏干十神、纳音、星运、自坐、旬、旬空及神煞查表命中。
- auxiliary：胎元、胎息、八字命宫／身宫及纳音。不是紫微命身宫，也不是实际受孕日。
- month_commander：本次采用的分日司令、距实际入节秒数、各段区间和规则号；与原月令本气分开。
- qiyun.start_after_jie、各步大运 handover_after_jie：实际交运瞬间相对上一节的距离，不用笼统的“某年节后几天”取代精确交运时间。
- at_target：已请求目标日期的流年、流月、精确当前大运、小运和公历年虚岁；没有 target_date 就不造“当前”。
- supported_shensha、sources、conventions：所支持的14种查表、来源及口径。未列出的神煞不自行补算。

需要各步大运和逐年流年／小运时，执行返回 purpose=bazi_periods_page 的完整 argv。--page bazi-periods 支持 --offset、--limit、--years YYYY:YYYY；依序返回大运、已计算流年、对应公历年小运，按 next_offset 翻页。后页不再重复本命；流年范围仍以原盘已计算范围为限，不能把没有结果解释成“该年没有神煞”。

细盘页 --report 才导出程序生成的专业细盘 Markdown/HTML，包含完整岁运表及来源。报告写到任务目录的 report.md/html；默认不生成，也不改变原 chart.json。若需保留已有普通报告，可加 --out 新的匿名导出目录。原 --report 无细盘页时仍输出原报告。

## 不能混用的字段

| 字段 | 查法 |
| --- | --- |
| star_fortune 星运 | 本命日干对本列地支；十干十二长生，阳顺阴逆，土随火 |
| self_seat 自坐 | 本列自身天干对自身地支；不固定用本命日干 |
| xun_kong 本列旬空 | 本列干支所属旬的两个空支 |
| void_by_natal.day / year | 本列地支是否落入本命日柱／年柱的旬空，不能拿本列旬空直接判断自己落空 |
| stem_ten_god / hidden_ten_gods | 显干／藏干分别列示；日柱自身仍标日主 |
| shensha.references | 从哪一柱、哪个字段查得，实际落在当前行；岁运只据原局查入，不反写为原局已有 |

神煞支持天乙、太极、文昌、福星、禄神、天德、月德、德秀、桃花、驿马、华盖、将星、劫煞、亡神。每项按 rule_id 查 [固定规则](bazi-detail-rules.json)。年干／年支旁查和日干／日支主查分列；文昌采用《命理探源》表，年查是显示扩展。天德四卦按坤申、乾亥、艮寅、巽巳，不与《考原》另一表混合。太极与福星是明示的单支宽查；福星保留所引歌诀丙戌、丁酉条，不冒称各软件一致。德秀分“德／秀”命中，不凭一个标记直接称完整格局成立。

司令采用《三命通会》卷二原表（如寅月5/5/20），不混用9/3/18等别表。从真实入节瞬间起算，每日86400秒，末段延续至下一个节，起含终不含；没有将实际节月强制缩放为30天。古籍的辰月壬、未月甲、戌月丙、丑月庚等墓库五行保留，不冒充现行藏干数组。这是选定口径，不宣称问真采用同一表。

小运从本盘实际采用的时柱按已有起运顺逆逐年推进，出生公历年一岁、每公历年进一；与立春流年周期及紫微小限分开。特别是1月／立春前，目标日期小运按当年公历年，流年可能仍属上一立春周期。命身宫、胎息也使用本盘已选节月／时柱／换日规则，真太阳时和海外时区不回退成北京时间日时柱。

公式与来源由代码固定，细盘规则版本独立为 bazi-professional/1.0.0。父 context.source_checksum 仍绑定原命盘，细盘不修改原历法、采样、合冲、缓存输入或原产物 schema。输出契约见 [细盘 schema](bazi-detail-context.schema.json)。
