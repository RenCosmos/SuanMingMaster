# RikkaHub 安装说明 · V1.1.5

1. 将完整安装 ZIP 保存到手机，在 RikkaHub 2.5.6「技能 / Skills」中从文件导入并启用 `bazi-ziwei`。
2. 将助手系统提示词替换为仓库中的 `RikkaHub系统提示词.txt`。
3. 创建 Linux Workspace（Ubuntu / Debian），让助手或会话绑定该工作区，并启用工具调用。技能挂载路径为 `/skills/bazi-ziwei`。
4. 运行自检：

```sh
sh /skills/bazi-ziwei/scripts/mobile.sh --check --self-test
```

缺少 Node.js 20+ 时，在 Ubuntu / Debian 工作区运行：

```sh
apt-get update && apt-get install -y ca-certificates curl xz-utils
sh /skills/bazi-ziwei/scripts/install-node.sh
sh /skills/bazi-ziwei/scripts/mobile.sh --check --self-test
```

安装器选择 ARM64 / x64 的固定官方 Node.js，验证 SHA-256。首次环境准备需要联网；完整 ZIP 已包含计算与知识检索依赖。自检退出码为 0、未超时且 JSON 中 `ok: true` 表示通过。

可以直接请求排盘、比较不确定时辰、根据六次真实摇卦排六爻，或“帮我写一份祭祖表文”。疏文不需要出生时辰，给出落款姓名、对象称呼、日期与心意即可；默认在聊天中出稿，需要保存时才导出。

完整源码与知识库在安装 ZIP 的 `bazi-ziwei/` 中。解压后可阅读 `SKILL.md`、`手机安装说明.md`、`使用说明.md` 和 `references/` 方法文档。完整包为 599 个文件，程序与知识资料不含用户历史个人输入。
