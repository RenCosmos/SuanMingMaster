# V1.3.5 关键测试

手机包保留 scripts/critical-checks.cjs 一份精简测试模块。--check 检查Node、ICU、时区和固定依赖；--check --self-test 执行下列12组关键回归，返回每组编号及结果。无输入文件、命盘或报告落盘。日常排盘与缓存追问不运行这组测试。

| 编号 | 核对的关键结果 | 预期来源 |
| --- | --- | --- |
| BZ-FIXED | 两个固定命例的全部四柱 | 6tail上游测试样例 |
| BZ-ZI-BOUNDARY | 晚子时两种换日口径和五鼠遁时干 | 上游日柱样例；按甲己日起甲子等五鼠遁固定表核算，默认day_stem口径 |
| BZ-LUNAR-LEAP | 2023闰二月初一对应公历；拒绝2024伪造闰月 | 独立历法固定日期 |
| BZ-SOLAR-DST | 1990上海夏令时真实UTC+9、太阳时；西部太阳时跨日前一日 | 已记录NOAA原函数固定向量和IANA时区数据 |
| BZ-LICHUN | 立春边界前后年/月柱；1月仍属上一个流年周期 | lunar-typescript固定节气边界及立春周期约定 |
| ZW-FIXED | 命身宫、命主身主、五行局、大限/流年索引、虚岁和流年四化 | iztro上游固定样例 |
| LY-MIXED | 9/7/7/6/8/8：泰变恒、初四爻动、世应、纳甲；变爻六亲依本宫 | 底爻至上爻手算、八宫纳甲表与bopo/najia参考测试 |
| AN-SPOUSE-CONTEXT | 合成命例2030比肩年仍有夫妻宫寅午戌；藏干十神和原局已齐全标记；摘要不丢失 | 合成四柱与干支关系表人工核对，未使用用户反馈的生辰 |
| TC-CANDIDATES | 辰/巳候选盘时柱不同、日柱一致，保留共同与变化项 | 固定时辰边界和对照不变量 |
| REL-SINGLE-AGE | 本人单盘可执行年龄取象，不输出精确年龄差 | 已核对的紫微配对规则及单盘接口约定 |
| KB-RETRIEVAL | 103主题完整性（原93、4八字卡保留、另加6六爻卡）、六爻具体术语及桃花／宗教问题路由、出处身份与小型返回 | 已存来源卡、许可、推断范围及内容摘要校验 |
| SW-LUNAR-DATE | 疏文日期支持真实闰月、拒绝伪造闰月 | 固定历法日期 |

预期值写成固定常量或行为不变量，不从待测程序即时生成。“生成后重算”继续用于结果完整性验证，不能代替这些预期断言。立春秒级用例验证本包采用的lunar-typescript边界；不同历法的边界差异仍按原60秒复核带处理。

## 开发验证

开发源码包包含 tests/，手机安装包不包含它。新增29项关键开发验证：12项固定回归、9项错误注入检测、8项实际mobile.sh流程。故意改错时干、时区、命宫、动爻顺序、夫妻宫关系、候选时柱和单盘来源，以及只在context中删掉关系，都必须被检测出来。真实shell还核对自检失败退出码、20年分页无遗漏、20KiB响应和28KiB转义包装预算、缓存复用、拒绝不同出生输入覆盖任务、临时输入成功/异常清理、重签篡改拒绝及知识查询不落盘。

```sh
corepack pnpm install --frozen-lockfile --ignore-scripts
corepack pnpm run test:critical
corepack pnpm test
```

Windows开发环境使用Git sh，可用SUANMING_TEST_SH指定sh.exe绝对路径；Linux直接使用sh。两项旧报告测试改用自行创建和清理的临时目录，消除对预先存在work目录和并行执行顺序的依赖。

本组验证程序计算、数据传递和文件生命周期。知识原文未改；模型的措辞和命理解读质量需另行用实际问题评估，不能由程序测试数量推定。

## 预期出处

- [6tail EightCharTest.py](https://github.com/6tail/lunar-python/blob/master/test/EightCharTest.py)：固定四柱及子时样例。
- [iztro astro.test.ts](https://github.com/SylarLong/iztro/blob/main/src/__tests__/astro/astro.test.ts)：固定紫微样例，本包依赖2.6.1。
- [NOAA原始太阳计算函数](https://gml.noaa.gov/grad/solcalc/main.js)：选用已记录的均时差向量，原文件SHA-256为3832956f24724eafacf9e18173b9299b1554d6252bed0784d9c9aca6d9f54856；完整18例和2412条月度向量仍在noaa-solar-fixtures.json，日常不读取。
- [bopo/najia](https://github.com/bopo/najia)：纳甲、八宫世应参考；混合爻值的本变卦由阴阳翻转规则手工核对。
- 原 [真太阳时与理论说明](true-solar-time.md) 及 references/verification 的独立寿星历、NOAA和节气查核资料均保留。

## V1.2.3 运行缺陷回归

开发源码新增9项定向测试，覆盖源盘/摘要碰撞与原字节保留、报告输入及硬链接保护、默认选项等价缓存、四种模式归一化不排盘、39候选仅78次基础排盘、重签候选及关系证据篡改拒绝、真实双进程争用、已结束进程的锁恢复及异常释放、临时输入清理后只发布一次摘要。测试只在开发源码，不加入手机日常调用。源码统一用packageManager指定的pnpm版本及frozen lockfile安装。
