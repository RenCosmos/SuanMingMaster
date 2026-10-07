# 输入契约 · 引擎 0.4.0 / V1.1.1

> V1.2.0 日常执行以 SKILL.md 的 workflow 为准：同次计算校验，直接读主题 context，追问用 --reuse。本页保留的 run.cjs / --verify / 完整 JSON 示例用于维护核对，无需逐次执行；计算口径与规则仍适用。


`examples/input.json` 是明确出生时间的匿名合成例子。以下字段用于 bazi / ziwei / both；出生时间不确定时改用 [时辰对照输入](time-compare-method.md)，不在本契约中猜填 birth.time。输入为 UTF-8 JSON（允许 BOM），未知字段会报错。

| 字段 | 要求 |
| --- | --- |
| mode | `both`（默认）、`bazi`、`ziwei` |
| label | 可选匿名标签，最长 80 字 |
| birth.calendar | 必填，`solar` 或 `lunar` |
| birth.date | 必填，`YYYY-MM-DD`，出生年份 1900–2100 |
| birth.time | 必填，`HH:mm` 或 `HH:mm:ss`，明确的钟表时间 |
| birth.gender | 必填，`male` 或 `female`，传统排运规则参数 |
| birth.timezone | 必填，IANA 名称如 `Asia/Shanghai` 或已核实偏移如 `+08:00` |
| birth.is_leap_month | 仅农历使用的布尔值，默认 false |
| birth.longitude | 可选数字，−180 至 180，东经正、西经负；true_solar 必填 |
| birth.longitude_source | 可选经度来源文字，最长 400 字，须随经度提供 |
| target_date | 可选分析日期，`YYYY-MM-DD`；不指定就不输出目标岁运，不能早于出生日期 |
| options | 可选，见下表 |

| options 字段 | 值与默认值 |
| --- | --- |
| time_basis | `clock` 默认或 `true_solar`（需经度）；both 时太阳时只用于八字日时 |
| bazi_day_boundary | `midnight`（默认，lunar-typescript sect=2）或 `late_zi`（sect=1） |
| bazi_hour_stem_rule | `day_stem` 默认：已选日干五鼠遁；`library`：兼容旧库晚子时推法 |
| ziwei_day_boundary | `late_zi`（默认，iztro forward）或 `midnight`（current） |
| ziwei_year_boundary | 只控制**本命年干支**：`lunar_new_year`（默认 normal）或 `lichun`（exact）。不控制运限；运限年/月仍按 iztro normal 的农历年/月界 |
| ziwei_leap_adjust | true（默认），闰月前 15 天按本月，之后按下月；false 不调整 |
| ziwei_algorithm | `default`（默认）或 `zhongzhou` |
| dayun_count | 八字大运数量，1–12，默认 8 |
| annual_count | 八字流年周期数，1–20，默认 5 |

## 时间处理

Temporal 按所填时区解析真实出生瞬间并保留实际 UTC 偏移。夏令时不存在或重复的钟表时间会报错，需用户核实偏移。`Asia/Shanghai` 在部分历史年份的夏季是 +09:00，程序不会假定始终 +08:00。

八字年/月柱和起运使用真实出生瞬间的北京时间匹配十二节。clock 模式日/时柱使用所填钟表记录；true_solar 模式使用经度、均时差及实际 UTC 偏移校正的太阳钟面日期时间，正确处理跨日。出生 UTC 瞬间不变；实际偏移已含历史夏令时，不再重复扣除。birth.time 始终填原始钟表记录，不能填写手动校正的时间后再选择 true_solar。完整公式与验证见 [真太阳时方法](true-solar-time.md)。

默认 midnight 日界的晚子日柱留在当日，时干从已选日干起五鼠遁；late_zi 日界的日柱在 23 点进位，时干随新日干计算。bazi_hour_stem_rule:library 兼容旧版当日日柱/次日日干起时。具体案例和理论依据见 [子平核对](bazi-theory-audit.md)。仅紫微模式拒绝 true_solar；both 模式紫微仍使用钟表记录。

紫微引擎接收出生地钟表公历日期和时辰序号，闰月、换年、换日均在 JSON 留痕。`chinese_date` 是 iztro 提供的辅助干支信息，不能代替八字引擎的四柱，尤其当口径不同或出生地不在 UTC+8 时。

紫微 `conventions.year_boundary` 保留兼容，含义为本命年界；新增 `natal_year_boundary` 明确该含义，`year_boundary_scope=natal_only`。`horoscope_year_boundary=lunar_new_year`、`horoscope_month_boundary=lunar_month` 分别标明运限年/月界。V1.3.1不更改旧 `yearDivide` / `horoscopeDivide` 算法：2024-02-05在立春后、春节前，八字目标年为甲辰，紫微流年仍为癸卯；不是将本命立春参数套在流年。配置含义见[iztro官方说明](https://docs.iztro.com/posts/config-n-plugin)。目标日仍按原正午规则，不声称支持目标节气秒级瞬间。

目标分析日期统一取**出生地正午**作为展示用参考时刻：这不代表该日期所有时刻都处于同一节气。出生时间范围比较使用独立的时辰对照模式；目标分析日期的参考时刻沿用本页规则。

## 输出契约

本版计算引擎为 0.4.0：旧版本 JSON 使用对应原包校验，或用原始输入在 V1.1.1 重算。关系 schema/v3 与时辰对照 schema/v1 保留，嵌入盘版本和对照引擎已更新。

顶层：`schema_version`、`skill_version`、`input`（含默认值的规范输入）、`normalized`、`warnings`、`provenance`、按 mode 选择的 `bazi` / `ziwei` 和 `checksum`。

每个体系包含 `chart`（程序计算事实）与 `calculations`（衍生计算）。八字有逐项权重账本、规则文件摘要和 theory_evidence（月令、通根、透干及五虎遁/五鼠遁）；提供经度时另有 time_validation，年/月柱有 jieqi_boundary_review；紫微有星曜、宫位、四化和三方四正证据编号。计算引擎依赖本地文件，不主动调用远端排盘/解读API或上传生辰；但用户消息和工具上下文可能经RikkaHub发送给所选模型供应商，不能把本地计算等同于聊天完全离线。规范输入仍保存在chart.json中，stdin不落中间文件不代表无资料留存。

校验和按排序后的 JSON 内容计算。`--verify` 还按输入重新运行引擎，比较命盘、计算、警告、归一化时间及引擎/规则版本。不同 Node/ICU 时区数据库版本可能在历史时间上产生差异，因此记录版本并允许校验失败后要求重算。

## v3 关系输入

`mode: relationship` 使用独立的 people/context 契约，见 [关系方法与示例](relationship-method.md)。不能把 relationship 的 people 字段混入原有 bazi / ziwei / both 输入。卜卦仍使用 divination。

## 按需输出与 v5 单人画像

普通模式 CLI 默认只保存 chart.json；time_compare 默认另保存 comparison.json 计算摘要。文件报告使用显式 --report / --render，AI 解读默认在聊天中回复。年龄与性能力专题见 [相应方法](age-intimacy-output.md)。对象形象、生肖及单人八字/紫微年龄取象见 [对象画像方法](partner-image-method.md)。

## V6.2.0 年度输出增补

输入字段及 annual_count 范围不变。年度项新增 stem、branch、hidden_stems、hidden_ten_gods、pillar_relations、day_branch_relations；关系标明 relation_field、touches_day_branch，组合另标原局已有状态及原局来源。完整定义见 [年度关系方法](annual-relations.md)。基础计算版本升为 0.3.0，旧产物以原包验证或以原输入重算。

## V1.1.1 输出增补

大运项补齐显干、地支、藏干十神、四柱关系和日支关系；紫微新增 calculations.palace_stem_flying，含 48 条宫干四化、实际落点、自化及每宫收发索引。关系画像与时辰对照保留本人的实际来源，详见 [大运与飞化方法](dayun-flying-method.md)。基础引擎 0.4.0、关系 0.6.0、时辰对照 0.5.0；基础输入与 schema 名称保留；V1.1.4 关系派生 schema 升为 v4，时辰对照引擎升为 0.5.0。

## V1.1.2 CLI 输入生命周期

计算引擎与 JSON schema 未变，原 0.4.0 产物可直接校验。默认 --stdin 不生成输入文件；--temp-input PATH 用完清理，--input PATH 保留可复用资料。知识直接传参；详见 [输入生命周期](input-lifecycle.md)。
