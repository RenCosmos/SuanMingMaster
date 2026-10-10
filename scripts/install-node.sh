#!/bin/sh
# Online setup only; run separately from chart/search commands.
set -eu
runtime=${SUANMING_RUNTIME_DIR:-/workspace/.bazi-ziwei-runtime}
target=$runtime/node22
version=22.23.3
ready() { "$1" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 && process.versions.icu ? 0 : 2)' >/dev/null; }
if [ -x "$target/bin/node" ] && ready "$target/bin/node"; then printf '%s\n' '已有工作区Node，复用，不下载。'; exit 0; fi
if [ -e "$target" ]; then printf '%s\n' '已有不完整的运行时目录；保留它，请检查后再安装。' >&2; exit 2; fi
if [ ! -r /etc/os-release ]; then printf '%s\n' '安装器要求Ubuntu/Debian工作区。' >&2; exit 2; fi
. /etc/os-release
case "$ID" in ubuntu|debian) ;; *) printf '%s\n' '安装器仅支持Ubuntu/Debian glibc工作区。' >&2; exit 2 ;; esac
case "$(uname -m)" in
 aarch64|arm64) arch=arm64; expected=5ced2d48d1d7198739b7f86804de0171aefb6823b684b12341d3321afc3cb0b2 ;;
 x86_64) arch=x64; expected=1084aa36196bba4c3a5e69a1ee388a6e4ff729dad09445fbcd434b28fe3c24af ;;
 *) printf '%s\n' '仅支持64位ARM/x86工作区。' >&2; exit 2 ;;
esac
for tool in curl tar sha256sum mktemp; do
 if ! command -v "$tool" >/dev/null 2>&1; then printf '缺少%s。先单独准备基础工具：apt-get update && apt-get install -y ca-certificates curl tar gzip\n' "$tool" >&2; exit 2; fi
done
seconds=${SUANMING_DOWNLOAD_TIMEOUT:-90}
case "$seconds" in ''|*[!0-9]*) printf '%s\n' '下载超时须为30..300秒的整数。' >&2; exit 2 ;; esac
if [ "$seconds" -lt 30 ] || [ "$seconds" -gt 300 ]; then printf '%s\n' '下载超时须为30..300秒。' >&2; exit 2; fi
mkdir -p "$runtime"
stage=$(mktemp -d "$runtime/.install.XXXXXX")
case "$stage" in "$runtime"/.install.*) ;; *) printf '%s\n' '临时安装路径无效。' >&2; exit 2 ;; esac
trap 'rm -rf -- "$stage"' 0
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
archive=node-v$version-linux-$arch.tar.gz
printf '下载Node %s（最长%s秒），不下载命理数据。\n' "$version" "$seconds" >&2
curl --fail --location --proto '=https' --proto-redir '=https' --connect-timeout 10 --max-time "$seconds" "https://nodejs.org/dist/v$version/$archive" -o "$stage/$archive"
printf '%s  %s\n' "$expected" "$stage/$archive" | sha256sum -c -
mkdir "$stage/node22"
tar -xzf "$stage/$archive" -C "$stage/node22" --strip-components=1
ready "$stage/node22/bin/node"
mv -- "$stage/node22" "$target"
printf '%s\n' '安装完成；运行mobile.sh --check --self-test一次，然后继续原任务。'
