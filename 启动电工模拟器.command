#!/bin/bash
# 电工模拟器 一键启动器（双击即可打开）
# 作用：确保依赖已安装且是最新，启动本地服务器，并自动在浏览器中打开。

set -e

# 以脚本自身位置定位项目，文件夹移动/改名/换机器都不受影响
PROJECT="$(cd "$(dirname "$0")/web" && pwd)"

# 让 Homebrew 安装的 node/npm 在双击运行时也能被找到
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

fail() {
  echo ""
  echo "❌ $1"
  echo "窗口不会自动关闭，按回车退出。"
  read -r _
  exit 1
}

clear
echo "=============================="
echo "   ⚡️ 电工模拟器 启动中…"
echo "=============================="
echo ""

cd "$PROJECT" || fail "找不到项目目录：$PROJECT"

command -v npm >/dev/null 2>&1 || fail "没找到 npm/node。请先安装 Node.js (https://nodejs.org)。"

# vite 8 要求 Node 20.19+ 或 22.12+
NODE_VERSION="$(node -v | sed 's/^v//')"
NODE_MAJOR="${NODE_VERSION%%.*}"
NODE_MINOR="$(echo "$NODE_VERSION" | cut -d. -f2)"
if [ "$NODE_MAJOR" -lt 20 ] \
  || { [ "$NODE_MAJOR" -eq 20 ] && [ "$NODE_MINOR" -lt 19 ]; } \
  || [ "$NODE_MAJOR" -eq 21 ] \
  || { [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -lt 12 ]; }; then
  fail "Node.js 版本过旧（当前 v$NODE_VERSION）。需要 20.19+ 或 22.12+，请到 https://nodejs.org 升级。"
fi

# 每次都核对依赖：项目更新后（如升级 vite）旧的 node_modules 也能自动跟上；
# 依赖已是最新时这一步只需一两秒。
echo "📦 正在核对依赖…"
npm install || fail "依赖安装失败，请把上面的报错发给维护者。"
echo ""

echo "🚀 正在启动，浏览器会自动打开…"
echo "   关闭本窗口即可停止程序。"
echo ""

# 启动开发服务器并自动打开浏览器（始终使用最新代码）
exec npm run dev -- --open
