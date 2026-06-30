#!/bin/bash
# 马克档 macOS 安装脚本
# 双击或在终端运行：bash install.command

set -e

APP_NAME="马克档"
APP_BUNDLE="$APP_NAME.app"

echo "===================================="
echo "  马克档 · macOS 安装"
echo "===================================="
echo ""

# 检查 .app 是否存在
if [ ! -d "$APP_BUNDLE" ]; then
    echo "❌ 错误：找不到 $APP_BUNDLE"
    echo "请确保 install.command 和 $APP_BUNDLE 在同一目录"
    exit 1
fi

# 目标路径
TARGET="/Applications/$APP_BUNDLE"

# 检查是否已安装
if [ -d "$TARGET" ]; then
    echo "⚠️  检测到已安装的版本"
    read -p "是否替换？[y/N] " REPLACE
    if [[ ! "$REPLACE" =~ ^[Yy]$ ]]; then
        echo "已取消"
        exit 0
    fi
    rm -rf "$TARGET"
fi

# 复制到 /Applications
echo "📦 正在复制到 /Applications..."
cp -R "$APP_BUNDLE" "$TARGET"

# 移除隔离属性（绕过 Gatekeeper）
echo "🔓 解除 Gatekeeper 限制..."
xattr -cr "$TARGET" 2>/dev/null || true
xattr -d com.apple.quarantine "$TARGET" 2>/dev/null || true

# 注册为已知 app（可选，避免首次打开的未知开发者警告）
# spctl --assess --verbose=4 "$TARGET" 2>/dev/null || true

echo ""
echo "✅ 安装完成！"
echo ""
echo "🚀 启动方式："
echo "   1. 打开 Launchpad / 应用程序 文件夹"
echo "   2. 找到 '马克档' 双击打开"
echo ""
echo "或者在终端运行："
echo "   open -a '$APP_NAME'"
echo ""

# 自动打开
read -p "现在启动吗？[Y/n] " LAUNCH
if [[ ! "$LAUNCH" =~ ^[Nn]$ ]]; then
    open "$TARGET"
    echo "🚀 已启动！"
fi

echo ""
echo "如果还有安全提示："
echo "  系统设置 → 隐私与安全性 → 仍要打开 → 输入密码"