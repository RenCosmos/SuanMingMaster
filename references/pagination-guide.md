# 按需证据续页

仅在当前context提示证据未覆盖所问范围时读。通用状态、缓存、预算和argv执行规则见[SKILL.md](../SKILL.md)；不重读完整命盘或为读完全部数据循环。

## 合盘双方与交叉证据

reading.pair_evidence.missing列出本页缺少的另一人物或comparison。先按people_page.next_person对应argv读另一人，再执行其comparison动作；显式--person页同样提供交叉入口。只有双方和本题需要的交叉证据齐备，才下合盘判断。

```sh
sh /skills/bazi-ziwei/scripts/mobile.sh --reuse CHART --brief --comparison --focus relationship --offset 0 --limit 3
```

comparison仅用于双人关系，不与--person、--years或时辰选择混用；程序返回的argv已处理这些选择。context.selection.comparison=true，reading.comparison保留双向日主投影、独立紫微对照及完整原记录的source IDs。

bazi.cross_relations及pillar_matrix各有total／offset／items／next_offset；共同游标是**context.reading.comparison_page.next_offset**，按较长列表推进。较短列表读完可为空，不能据此丢弃前页证据。next_actions返回下一页完整argv；合并同一task_id/source_checksum。

pair_evidence.page_is_last仅表示到末页；comparison_complete_in_this_response只有从0且本页覆盖全部交叉列表才为true。comparison_previous_pages提示仍需前页，末页空数组不等于关系为空。

## 年度与宫干飞化

brief视图的年度／飞化动作自动带--page annual或--page flying及--base-checksum，按返回argv执行即可，不自行重组。只在--reuse上使用；校验和来自基础context.source_checksum，错盘明确报错且不覆盖现有context。view=evidence_page、view_schema=suanming-evidence-page/v1标明这不是整盘：与同task_id/source_checksum的已读基础context合用。年度页保留实际相交的大运及边界，飞化页保留完整source IDs和游标；不会重发四柱、根气或其他本命字段。基础上下文丢失才用base_context.restore_argv恢复，正常续页不用重复恢复。

next_actions.required与required_for是用途提示；本次合盘缺失的双方／交叉证据需补，所问年度范围需读齐；未问的年度为可选展开，飞化是否补读取决于所下断语。不要把动作列表当成全读任务。旧不带--page的完整主题、时辰候选与合盘交叉入口仍保留。

--years只筛已计算的立春周期；requested_range_computed=false时，按原输入和用户范围调整target_date／annual_count，在新目录补算。年度按实际next_offset和返回limit续读，不用空页断无事。

宫干四化按palace_stem_flying.next_offset及purpose=flying_page的argv续读，必要时--flying-offset N；不是年度offset。只读当前判断涉及的发出／落入／自化证据，保留三方四正与关联宫。next_actions_deferred只暂缓次要导航，游标仍可用。

## 时辰字段、变体与候选

字段一致性按field_index／status读；--field TC-…展开具体字段，--variant-offset N读该字段变体，--candidate TC-001读取对应候选的有界主题视图。游标以实际next_variant_offset或返回argv为准，不自行固定加3。

stable／varies／single_candidate及coverage限定结论范围；不可算点仍需说明，一致项不覆盖未计算的连续分钟。多个候选不拼成一张不存在的盘，不按数量认定出生概率。

## 候选批量与疏文

批量execution.state=yielded先执行--resume；complete后才选月份、日期、时辰details.argv，当前最高必须ranking_final=true。见[批量契约](partner-search-batch-method.md)。

疏文text_page.next_offset非空则重放同一JSON，核对document_sha256后拼接text；续页不重复--out。见[制文契约](shuwen-method.md)。
