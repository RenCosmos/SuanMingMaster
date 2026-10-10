#!/bin/sh
set -eu
skill_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
# 检索参数直接转交知识 CLI；排盘 --stdin 不落盘，--temp-input 由 Node finally 清理。
temp_input=
temp_requested=0
case "${1:-}" in
  --temp-input) temp_input=${2:-}; temp_requested=1 ;;
  --knowledge|--knowledge-full|--shuwen|--agent|--engine) if [ "${2:-}" = --temp-input ]; then temp_input=${3:-}; temp_requested=1; fi ;;
esac
if [ "$temp_requested" -eq 1 ]; then
  count=0
  for arg in "$@"; do if [ "$arg" = --temp-input ]; then count=$((count + 1)); fi; done
  case "$temp_input" in ''|--*) printf '%s\n' '{"ok":false,"error":"--temp-input 后须提供文件路径"}' >&2; exit 2 ;; esac
  if [ "$count" -ne 1 ]; then printf '%s\n' '{"ok":false,"error":"--temp-input 只能提供一次"}' >&2; exit 2; fi
  # 文件清理只作用于本次显式交付的普通文件，不扫描目录；解析真实父目录保护技能资源。
  temp_parent=$(CDPATH= cd -- "$(dirname -- "$temp_input")" && pwd -P)
  temp_name=$(basename -- "$temp_input")
  temp_input=$temp_parent/$temp_name
  case "$temp_input" in "$skill_dir"/*) printf '%s\n' '{"ok":false,"error":"技能包资源不能标记为临时输入"}' >&2; exit 2 ;; esac
  temp_lower=$(printf '%s' "$temp_name" | tr '[:upper:]' '[:lower:]')
  case "$temp_lower" in chart.json|batch.json|scan-checkpoint.json|context.json|brief.json|validation.json|comparison.json|report.md|report.html|reading.md|shuwen.txt|shuwen.html)
    printf '%s\n' '{"ok":false,"error":"结果文件不能标记为临时输入"}' >&2; exit 2 ;;
  esac
  if [ -L "$temp_input" ] || { [ -e "$temp_input" ] && [ ! -f "$temp_input" ]; }; then
    printf '%s\n' '{"ok":false,"error":"临时输入必须是普通文件"}' >&2; exit 2
  fi
  temp_identity=
  if [ -f "$temp_input" ]; then temp_identity=$(LC_ALL=C ls -din --full-time -- "$temp_input"); fi
  cleanup_temp() {
    status=$?
    trap - 0 HUP INT TERM
    if [ -e "$temp_input" ] || [ -L "$temp_input" ]; then
      current=$(LC_ALL=C ls -din --full-time -- "$temp_input") || exit 2
      if [ -z "$temp_identity" ] || [ -L "$temp_input" ] || [ ! -f "$temp_input" ] || [ "$current" != "$temp_identity" ]; then
        printf '%s\n' '{"ok":false,"error":"临时输入在执行期间改变，已保留该文件","type":"cleanup_error"}' >&2
        exit 2
      fi
      rm -f -- "$temp_input" || { printf '%s\n' '{"ok":false,"error":"临时输入清理失败","type":"cleanup_error"}' >&2; exit 2; }
    fi
    exit "$status"
  }
  trap cleanup_temp 0
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM
fi
node_cmd=
node_source=
cached_node=${SUANMING_RUNTIME_DIR:-/workspace/.bazi-ziwei-runtime}/node22/bin/node
node_ready() { "$1" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 && process.versions.icu ? 0 : 1)' >/dev/null 2>&1; }
if [ -n "${SUANMING_NODE:-}" ]; then
  if [ -x "$SUANMING_NODE" ] && node_ready "$SUANMING_NODE"; then node_cmd=$SUANMING_NODE; node_source=explicit; fi
elif command -v node >/dev/null 2>&1; then
  if node_ready "$(command -v node)"; then
    node_cmd=$(command -v node)
    node_source=system
  fi
fi
if [ -z "$node_cmd" ] && [ -x "$cached_node" ] && node_ready "$cached_node"; then node_cmd=$cached_node; node_source=workspace_private; fi
if [ -z "$node_cmd" ]; then
  printf '%s\n' '{"ok":false,"type":"runtime_missing","error":"工作区缺少Node.js 20+及ICU","action":"单独运行sh /skills/bazi-ziwei/scripts/install-node.sh联网准备Node，再检查一次并继续原任务；不要把安装与候选扫描串成一条命令"}' >&2
  exit 2
fi
case "${1:-}" in --knowledge|--knowledge-full) ;; *)
  for dep in iztro lunar-typescript @js-temporal/polyfill jsbi; do
    if [ ! -f "$skill_dir/node_modules/$dep/package.json" ]; then
      printf '%s\n' '{"ok":false,"type":"bundled_dependencies_missing","network_allowed":false,"error":"完整安装包的node_modules资源不完整；不是工作区需要npm安装","action":"重新导入完整安装ZIP，不复制脚本到工作区、不运行npm/pnpm/apt"}' >&2
      exit 2
    fi
  done ;;
esac
export SUANMING_NODE_SOURCE=$node_source
run_node() {
  if [ -n "$temp_input" ]; then "$node_cmd" "$@"; else exec "$node_cmd" "$@"; fi
}
case "${1:-}" in
  --check) shift; run_node "$skill_dir/scripts/preflight.cjs" "$@" ;;
  --knowledge) shift; run_node "$skill_dir/scripts/knowledge-context.cjs" "$@" ;;
  --knowledge-full) shift; run_node "$skill_dir/scripts/knowledge.cjs" "$@" ;;
  --shuwen) shift; run_node "$skill_dir/scripts/shuwen.cjs" "$@" ;;
  --agent) shift; run_node "$skill_dir/scripts/workflow.cjs" "$@" ;;
  --engine) shift; run_node "$skill_dir/scripts/run.cjs" "$@" ;;
  --stdin|--input|--temp-input|--reuse) run_node "$skill_dir/scripts/workflow.cjs" "$@" ;;
  *) run_node "$skill_dir/scripts/run.cjs" "$@" ;;
esac
