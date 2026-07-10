#!/bin/bash
# 电工模拟器 一键启动器（双击即可打开）
# 作用：确保依赖已安装，启动本地服务器，并自动在浏览器中打开。

set -e

PROJECT="/Users/dinisha/Documents/电工模拟器/web"

# 让 Homebrew 安装的 node/npm 在双击运行时也能被找到
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

clear
echo "=============================="
echo "   ⚡️ 电工模拟器 启动中…"
echo "=============================="
echo ""

cd "$PROJECT"

if ! command -v npm >/dev/null 2>&1; then
  echo "❌ 没找到 npm/node。请先安装 Node.js (https://nodejs.org)。"
  echo "窗口不会自动关闭，按回车退出。"
  read -r _
  exit 1
fi

# 首次运行或依赖缺失时自动安装
if [ ! -d node_modules ]; then
  echo "📦 首次运行，正在安装依赖（只需一次，请稍候）…"
  npm install
  echo ""
fi

echo "🚀 正在启动，浏览器会自动打开…"
echo "   关闭本窗口即可停止程序。"
echo ""

# 启动开发服务器并自动打开浏览器（始终使用最新代码）
exec npm run dev -- --open
