# 年龄取象、亲密专题与按需报告

年上/年下只需本人八字/紫微，优先age_reading；古籍主证、现代八字及柱位旁证分层，详见[情感方法](romance-method.md)及[兼容年龄接口](partner-age-method.md)。年龄、生肖与外形画像分别有账本，不要求未来对象生辰。

性能力专题使用 context.topics 的 sexual_ability，读取 intimacy_features 中实际十神透藏、五行、夫妻/福德/命宫与星曜。用户问到时先给有实际十神、星曜和宫位依据的亲密取象，说明主动与回应、表达与节奏的主要指向；已有经历用于核对。具体沟通方式仅在用户要求时补充，不转成心理诊断或咨询流程。

默认在聊天中回答。新 workflow 保存 chart.json、context.json、validation.json；[时辰对照](time-compare-method.md) 的完整候选保留在 chart，年龄分歧按候选解释。普通追问复用已核对数据，不自动写 report.md、report.html 或 reading.md。用户要求详细解释仍在聊天中展开；明确要生成/保存/导出/下载报告才写文件。

```sh
# 默认只生成计算 JSON
sh /skills/bazi-ziwei/scripts/mobile.sh --temp-input /workspace/bazi-ziwei-reports/TASK/input.json --out /workspace/bazi-ziwei-reports/TASK/result
# 用户明确需要计算报告时，校验已有数据后导出
sh /skills/bazi-ziwei/scripts/mobile.sh --render /workspace/bazi-ziwei-reports/TASK/result/chart.json --out /workspace/bazi-ziwei-reports/TASK/result
# 首次即已要求文件报告
sh /skills/bazi-ziwei/scripts/mobile.sh --temp-input /workspace/bazi-ziwei-reports/TASK/input.json --out /workspace/bazi-ziwei-reports/TASK/result --report
```

默认用--stdin的带引号here-document，不创建输入文件；上面的--temp-input仅在必须传文件时使用，用完清理，见[输入生命周期](input-lifecycle.md)。reading.md也只在明确要求保存时写；核对本次files，不读取旧报告当本次结果，不修改计算数据迎合解释。
