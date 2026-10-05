# 开发与发布

版本以package.json为准；构建工具生成相关版本标签及验证记录。Node24、Python3、packageManager指定版本的pnpm为开发环境，运行时仍支持Node20+。pnpm-workspace.yaml配置扁平且无符号链接的依赖目录，确保ZIP解压后可独立运行；.npmrc仅用于旧版pnpm兼容。

```sh
corepack pnpm install --frozen-lockfile --ignore-scripts
corepack pnpm test
python tools/release.py --out ../release
```

Windows可通过--node指定node.exe、--sh指定Git sh.exe。所有开发测试留在源码；手机包仅携带运行代码、知识、使用资料、必要示例和12组关键自检。输出目录须在源码目录之外。

release.py直接运行当前测试并检查退出码，拒绝失败/跳过；逐字节查核知识基线，生成安装ZIP及不含node_modules的源码ZIP，检查归档与本地链接，然后从安装ZIP解包做自检、临时输入清理和缓存复用验收。验证结果在release-validation.json，测试日志在构建输出目录。GitHub Actions调用同一构建命令。

新增或更新知识时，明确审查来源/许可和正文后更新tools/knowledge-baseline.json；常规代码修复无需改该基线。tools/runtime-dependency-baseline.json保留已验证的运行依赖文件及哈希，生成手机包时按清单选取，排除包管理器本机路径元数据、重复缓存和开发声明文件。更新依赖时需复核该清单与冻结锁文件，再做解包验证。构建工具不自行上传，测试通过后再发布下载文件。
