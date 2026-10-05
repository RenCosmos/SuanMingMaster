> 本文件基于固定上游 README 改编；0.5.1 清理固定免责声明。

# bazi_skills

**赛博算命 SKILLS** — 东西方命理、术数、民俗占卜的 Cursor Agent 知识库与 AI 提示词引擎。

在线排盘，八字算命，八字排盘，四柱八字，工具软件，姓名排盘，姓名算命，姓名剖析，五格姓名，三才五格，八字分析，日主强弱，八字判断，三才五行，用神分析，流年分析，专业排盘，八字分析，起名取名，笔画分析，九宫姓名，八卦姓名，六格八运，天运姓名，王氏排盘，实战分析，铁口直断，

本仓库把 35 种术数的规则、计算步骤、查表与 **可直接复制给 AI 的提示词** 整理成一套可检索、可维护的技能库；配合排盘工具与任意大模型，即可完成「先排盘、再解读」的完整流程。

---
<img width="938" height="578" alt="image" src="https://github.com/user-attachments/assets/2e177bd8-d817-41f3-a868-111f658a56cf" />

<img width="1038" height="1041" alt="image" src="https://github.com/user-attachments/assets/a6355fe9-001b-49ca-997c-ee36fd6c9353" />

## 项目说明

| 模块 | 路径 | 用途 |
|------|------|------|
| **suanming Skill** | [`.cursor/skills/suanming/`](.cursor/skills/suanming/) | 35 种术数文档、查表、AI 提示词（Cursor @suanming 或复制给 ChatGPT / Claude） |
| **赛博算命 Web** | [`web/`](web/) | Vue 3 提示词搜索站：分类浏览、全文检索、一键复制 |
| **维护脚本** | [`.cursor/skills/suanming/scripts/`](.cursor/skills/suanming/scripts/) | 同步提示词、生成爻辞/纳甲/紫微日表等 |

---

## 推荐使用流程

```
① 确定要问什么（一事一占）
      ↓
② 选型：八字 / 六爻 / 塔罗 / 灵签 …（见下方列表或 Skill 决策树）
      ↓
③ 排盘 / 起卦 / 抽签（需排盘的术数 → 用排盘软件，见下文推荐）
      ↓
④ 复制本库「AI 提示词」，填入出生信息或排盘结果
      ↓
⑤ 粘贴至 AI，对照「输出模板」检查是否写全七步解析
```

**示例（八字看流年）**

1. 在 [青云八字](https://www.qingyun365.com/home) 输入出生信息，排出四柱与大运  
2. 打开 [`eastern/ziping-bazi.md`](.cursor/skills/suanming/eastern/ziping-bazi.md) 或 [Web 搜索站](http://127.0.0.1:5173) 复制提示词  
3. 把排盘结果（四柱、十神、大运、流年）填入提示词后发给 AI  

---

## 推荐排盘软件

做 **八字、大运、流年** 等需要准确干支与节气的术数时，建议先用专业排盘工具出盘，再把结果交给本库提示词 + AI 解读，避免 AI 自行推算干支出错。

| 工具 | 链接 | 说明 |
|------|------|------|
| **青云八字** | [https://www.qingyun365.com/home](https://www.qingyun365.com/home) | 在线八字排盘；适合快速排四柱、查大运流年，与本库子平八字、称骨等提示词配合使用 |

> 紫微、六爻、奇门等另有各自排盘方式；八字类问题优先推荐青云八字出盘后再解读。

---

## 快速开始

### 在 Cursor 中

1. 打开本项目，对话 **@suanming** 或说明需求（如「用六爻占这单生意能否成」）  
2. Agent 读取 [`SKILL.md`](.cursor/skills/suanming/SKILL.md) 选型后打开对应术数文档解读  

### 方式 A · 复制给任意 AI（推荐）

1. 打开术数文件，例如 [`eastern/ziping-bazi.md`](.cursor/skills/suanming/eastern/ziping-bazi.md)  
2. 复制 **「AI 提示词（直接复制使用）」** 整段（已含解析规范）  
3. 替换 `[…]` 中的出生信息、排盘结果、问题  
4. 粘贴到 ChatGPT / Claude / Cursor；对照同文件 **「输出模板」** 与 **「解析示例」** 检查输出  

### 方式 B · 集中索引

- [`docs/prompts.md`](.cursor/skills/suanming/docs/prompts.md) — 35 种提示词全集  
- [`docs/parsing-guide.md`](.cursor/skills/suanming/docs/parsing-guide.md) — 七步解析规范（信息校验 → 计算 → 术语 → 分项 → 结论 → 建议 ）  

### 方式 C · Web 搜索站

```bash
# 后端（端口 8765）
cd web/backend && pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8765

# 前端
cd web/frontend && npm install && npm run dev
```

浏览器打开 http://127.0.0.1:5173 — 搜索「八字」「塔罗」等，一键复制提示词。  
Windows 可双击 [`web/start.bat`](web/start.bat) 同时启动前后端。详见 [`web/README.md`](web/README.md)。

---

## 目录结构

```
bazi_skills/
├── README.md                    # 本文件
├── web/                         # 赛博算命提示词搜索站
└── .cursor/skills/suanming/
    ├── README.md                # Skill 详细说明与方式 A 速查表
    ├── SKILL.md                 # Cursor Agent 入口
    ├── docs/                    # 公共文档与查表
    │   ├── prompts.md           # 35 种 AI 提示词
    │   ├── parsing-guide.md     # 七步解析规范
    │   ├── reference.md         # 干支八卦纳音
    │   ├── yao-ci-64.md         # 64 卦爻辞
    │   ├── najia-64-cross.md    # 六爻纳甲交叉索引
    │   ├── ziwei-anxing.md      # 紫微安星
    │   ├── ziwei-ziwei-table.md # 安紫微日表
    │   ├── lingqian-poems.md    # 观音 100 签签诗
    │   └── chenggu-ge.md        # 称骨歌
    ├── scripts/                 # maintain.py 等维护脚本
    ├── eastern/                 # 东方术数（15）
    ├── western/                 # 西方占卜（14）
    └── folk/                    # 民俗占卜（6）
```

---

## 术数列表（35）

| 分类 | 术数 |
|------|------|
| **东方（15）** | 子平八字、紫微斗数、河洛理数、太乙神数、梅花易数、六壬神课、奇门遁甲、六爻、相术、七政四余、测字、龟甲、小六壬、佛教占察、铁板神数 |
| **民俗（6）** | 称骨、三才五格、灵签、掷筊、周公解梦、择日通胜 |
| **西方（14）** | 西洋占星、印度占星、塔罗、雷诺曼、地占、卢恩、数字命理、灵摆、茶叶占卜、水晶球、西方手相、扑克占卜、鸟占、书本占卜 |

**常见选型**

| 你想问… | 推荐 |
|--------|------|
| 一生格局、大运 | 八字 + [青云八字排盘](https://www.qingyun365.com/home)，紫微、河洛 |
| 具体一事成否 | 六爻、梅花、灵签、掷筊 |
| 何时 / 向哪 | 奇门、择日、小六壬 |
| 心理与方向 | 塔罗、雷诺曼、卢恩 |
| 梦境 | 周公解梦 |

完整决策树见 [`SKILL.md`](.cursor/skills/suanming/SKILL.md)。

---

## 维护

在技能库目录下执行：

```bash
python .cursor/skills/suanming/scripts/maintain.py
```

会同步 `prompts.md` → 各术数 md，并刷新方式 A 内嵌前缀与解析示例。  
生成查表：`generate_yao_ci.py`、`generate_najia_64.py`、`generate_ziwei_table.py`。

---

## 详细文档

- Skill 完整说明：[`.cursor/skills/suanming/README.md`](.cursor/skills/suanming/README.md)  
- Web 站说明：[`web/README.md`](web/README.md)
