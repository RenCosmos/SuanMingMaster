#!/bin/sh
# 只安装工作区私有运行时；不写系统目录，不需要 npm，不上传生辰。
set -eu
runtime=/workspace/.bazi-ziwei-runtime
target=$runtime/node22
version=22.23.3
if [ -x "$target/bin/node" ]; then
  "$target/bin/node" -e 'if(Number(process.versions.node.split(".")[0])<20) process.exit(2); console.log("现有工作区 Node 可用: " + process.version)'
  exit 0
fi
if [ -e "$target" ]; then printf '%s\n' '已有不完整的运行时目录；请检查 /workspace/.bazi-ziwei-runtime/node22，不自动覆盖。' >&2; exit 2; fi
if [ ! -r /etc/os-release ]; then printf '%s\n' '安装器要求 Ubuntu / Debian 工作区。' >&2; exit 2; fi
. /etc/os-release
case "$ID" in ubuntu|debian) ;; *) printf '%s\n' '安装器仅适配 Ubuntu / Debian（glibc）；请先使用 RikkaHub 默认 Ubuntu 工作区。' >&2; exit 2 ;; esac
case "$(uname -m)" in
  aarch64|arm64) arch=arm64; expected=a44aeb94849a299b22df10b9e622ec2f605c2183501bc40590705131de7c740f ;;
  x86_64) arch=x64; expected=df450af89261115ef9f9e3830c3eeb2cc9213b63c720b1af623cb5dcbe2e02de ;;
  *) printf '%s\n' '安装器支持 64 位 ARM / x86 工作区；当前架构不支持。' >&2; exit 2 ;;
esac
for tool in curl tar xz sha256sum mktemp; do
  if ! command -v "$tool" >/dev/null 2>&1; then printf '缺少 %s。Ubuntu 工作区先执行：apt-get update && apt-get install -y ca-certificates curl xz-utils\n' "$tool" >&2; exit 2; fi
done
mkdir -p "$runtime"
stage=$(mktemp -d "$runtime/.install.XXXXXX")
# mktemp 的固定前缀位于本技能的工作区目录，退出时只清理该临时目录。
trap 'rm -rf -- "$stage"' EXIT HUP INT TERM
archive=node-v$version-linux-$arch.tar.xz
curl --fail --location --proto '=https' --proto-redir '=https' --connect-timeout 20 --max-time 300 "https://nodejs.org/dist/v$version/$archive" -o "$stage/$archive"
printf '%s  %s\n' "$expected" "$stage/$archive" | sha256sum -c -
mkdir "$stage/node22"
tar -xJf "$stage/$archive" -C "$stage/node22" --strip-components=1
"$stage/node22/bin/node" -e 'if(Number(process.versions.node.split(".")[0])<20) process.exit(2); console.log("下载的 Node 可运行: " + process.version)'
mv -T -- "$stage/node22" "$target"
printf '%s\n' '安装完成。运行 sh /skills/bazi-ziwei/scripts/mobile.sh --check --self-test 检查排盘引擎。'
