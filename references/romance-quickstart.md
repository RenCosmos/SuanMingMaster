# 单人情感快速入口

用于“异性缘／桃花怎么样”“短缘与长缘哪条突出”的基础概况。本页已含合法输入和调用流程，无需再读关系完整契约或情感方法；合盘、明确多年窗口、对象画像与年龄问题才按主SKILL进入相应专题。

## 一次排盘

复用用户已给资料；只补问影响计算的缺项。公历需日期、时分、gender、IANA timezone；农历另填is_leap_month。出生地用于确定时区，不据地点自行改成真太阳时；未知时辰转主SKILL的时辰对照。

```sh
sh /skills/bazi-ziwei/scripts/mobile.sh --stdin --out /workspace/bazi-ziwei-reports/TASK --overview <<'SM_INPUT'
{"mode":"relationship","chart_mode":"both","question":"我的异性缘怎么样，短缘和长期关系哪条更突出？","people":[{"id":"a","birth":{"calendar":"solar","date":"1996-06-15","time":"12:00","gender":"male","timezone":"Asia/Shanghai"}}],"target_date":"2026-10-09","context":{"stage":"single","topics":["romance"]}}
SM_INPUT
```

这是合成样例，替换本次资料与客户端实际target_date；TASK换为本次唯一短匿名任务名。普通timeout=120秒。直接调用mobile.sh，不先ls、检查node、逐库检索或日常自检；仅实际runtime_missing才读手机安装说明单独安装。已有任务就--reuse明确files.chart --overview，不另排同一盘。自选wealth/authority/all或特殊排盘口径时才读完整关系契约。

## 核对后直接回答

按主SKILL核对外层状态及内层ok／validation.ok。context.view=overview，reading.people[0]含本命、当前精确大运、三方四正、相关宫和本主题飞化；emotional_paths分attraction与commitment，分别据实际透藏、桃花口径、星宫和制化断吸引交往与长期承接。先给哪条突出，再说两三条依据，不默认追加对象生日、画像、年龄或未来五年报告。不要将迁移无主星直接断为异地缘弱。

next_actions的required和required_for说明动作用途，不是要求全部执行。未问年份时annual_page为可选，不自动读；涉及未读四化的具体断语才补flying_page。证据齐了就回答，不重复读取relationship和romance、不为“更完整”继续展开。

## 追问才展开

问具体年份时执行返回annual_page.argv；这是--page annual --base-checksum原校验和的增量页，只含流年和相关大运，不重复本命。显干stem_ten_god与藏干hidden_ten_gods分开读，藏乙不能说成乙木透出。所问年份不在computed_years内，才按原输入补算新范围，不用空页断无缘。

增量页view=evidence_page，须与同task_id/source_checksum的已读基础context合用，不能单独当整盘。基础资料被上下文压缩遗失时执行base_context.restore_argv；不为每页重复恢复。画像、年龄、合盘或候选生日转主SKILL相应入口；同一问题不增加未请求功能。完整旧主题与命盘一直保留，更多续页细则仅遇问题才读[分页契约](pagination-guide.md)。
