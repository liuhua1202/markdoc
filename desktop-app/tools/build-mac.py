"""
手动构建 macOS .app bundle（无需 Mac 机器）
"""
import os
import shutil
import struct
import subprocess
import sys
from PIL import Image

ROOT = r"C:\Users\liuhua\Desktop\Github\markdown"
ELECTRON_MAC = r"C:\Users\liuhua\Temp\electron-mac-extract\Electron.app"  # 修正路径
ELECTRON_MAC = os.path.join(os.environ.get('TEMP', r'C:\Users\liuhua\AppData\Local\Temp'), 'electron-mac-extract', 'Electron.app')
DESKTOP_APP = os.path.join(ROOT, 'desktop-app')
BUILD_DIR = os.path.join(DESKTOP_APP, 'build')
OUTPUT = os.path.join(ROOT, '马克档.app')
ICON_PNG_512 = os.path.join(BUILD_DIR, 'icon-512.png')
ICON_PNG_256 = os.path.join(BUILD_DIR, 'icon-256.png')
ICON_PNG_128 = os.path.join(BUILD_DIR, 'icon-128.png')
ICON_PNG_64 = os.path.join(BUILD_DIR, 'icon-64.png')
ICON_PNG_32 = os.path.join(BUILD_DIR, 'icon-32.png')
ICON_PNG_16 = os.path.join(BUILD_DIR, 'icon-16.png')

def build_icns(png_sizes):
    """从多个 PNG 构建 .icns 文件
    ICNS 格式：'icns' + size(4字节大端) + chunks
    每个 chunk: type(4字节) + size(4字节) + data
    """
    # ICNS 类型代码（按尺寸）
    type_map = {
        16: b'icp4',   # 16x16
        32: b'icp5',   # 32x32
        64: b'icp6',   # 64x64
        128: b'ic07',  # 128x128
        256: b'ic08',  # 256x256
        512: b'ic09',  # 512x512
        1024: b'ic10', # 1024x1024
    }

    chunks = []
    for size, png_path in png_sizes.items():
        if size not in type_map:
            continue
        if not os.path.exists(png_path):
            continue
        with open(png_path, 'rb') as f:
            png_data = f.read()
        chunk_type = type_map[size]
        chunk_size = struct.pack('>I', len(png_data) + 8)
        chunks.append(chunk_type + chunk_size + png_data)

    if not chunks:
        return None

    body = b''.join(chunks)
    total_size = struct.pack('>I', len(body) + 8)
    return b'icns' + total_size + body


def main():
    # 检查源
    if not os.path.exists(ELECTRON_MAC):
        print(f"❌ 未找到 Electron.app: {ELECTRON_MAC}")
        sys.exit(1)

    print("=" * 50)
    print("  构建 macOS .app")
    print("=" * 50)
    print()

    # 1. 复制 Electron.app
    print("[1/5] 复制 Electron.app 框架...")
    if os.path.exists(OUTPUT):
        shutil.rmtree(OUTPUT)
    shutil.copytree(ELECTRON_MAC, OUTPUT)

    # 2. 删除默认 app
    print("[2/5] 清理默认应用...")
    default_app = os.path.join(OUTPUT, 'Contents', 'Resources', 'default_app.asar')
    if os.path.exists(default_app):
        os.remove(default_app)
    resources = os.path.join(OUTPUT, 'Contents', 'Resources', 'app')
    if os.path.exists(resources):
        if os.path.isdir(resources):
            shutil.rmtree(resources)
        else:
            os.remove(resources)
    # asar 打包后的文件名
    app_asar = os.path.join(OUTPUT, 'Contents', 'Resources', 'app.asar')
    if os.path.exists(app_asar):
        os.remove(app_asar)

    # 3. 创建 app/ 目录，复制应用文件
    print("[3/5] 复制应用文件到 Resources/app/...")
    os.makedirs(resources, exist_ok=True)

    # 主入口必须叫 main.js (Electron 默认查找)
    # 我们的 main.js 在 src/main.js
    # Resources/app/package.json (必需的)
    # Resources/app/src/main.js

    # 复制 package.json（必需，让 Electron 知道这是 Electron 应用）
    pkg_src = os.path.join(DESKTOP_APP, 'package.json')
    pkg_dst = os.path.join(resources, 'package.json')
    shutil.copy(pkg_src, pkg_dst)

    # 复制 src 目录
    src_src = os.path.join(DESKTOP_APP, 'src')
    src_dst = os.path.join(resources, 'src')
    shutil.copytree(src_src, src_dst)

    # 不复制 node_modules：Electron 已包含完整的 Node.js 运行时
    # 我们的 main.js 只用了 electron 内置模块，不需要额外 node_modules
    node_modules = os.path.join(DESKTOP_APP, 'node_modules')
    nm_dst = os.path.join(resources, 'node_modules')
    if os.path.exists(nm_dst):
        if os.path.isdir(nm_dst):
            shutil.rmtree(nm_dst)

    # 4. 生成 Info.plist
    print("[4/5] 生成 Info.plist...")
    plist = f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDisplayName</key>
	<string>马克档</string>
	<key>CFBundleExecutable</key>
	<string>Electron</string>
	<key>CFBundleIconFile</key>
	<string>icon</string>
	<key>CFBundleIdentifier</key>
	<string>com.makemdown.app</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>马克档</string>
	<key>CFBundlePackageType</key>
	<string>APPL</string>
	<key>CFBundleShortVersionString</key>
	<string>1.0.6</string>
	<key>CFBundleVersion</key>
	<string>1</string>
	<key>LSApplicationCategoryType</key>
	<string>public.app-category.productivity</string>
	<key>LSMinimumSystemVersion</key>
	<string>10.15</string>
	<key>NSHighResolutionCapable</key>
	<true/>
	<key>NSPrincipalClass</key>
	<string>AtomApplication</string>
	<key>NSSupportsAutomaticGraphicsSwitching</key>
	<true/>
	<key>NSHumanReadableCopyright</key>
	<string>MIT License</string>
	<key>CFBundleDocumentTypes</key>
	<array>
		<dict>
			<key>CFBundleTypeName</key>
			<string>Markdown Document</string>
			<key>CFBundleTypeRole</key>
			<string>Editor</string>
			<key>LSHandlerRank</key>
			<string>Owner</string>
			<key>LSItemContentTypes</key>
			<array>
				<string>net.daringfireball.markdown</string>
				<string>public.plain-text</string>
			</array>
		</dict>
	</array>
</dict>
</plist>
'''
    with open(os.path.join(OUTPUT, 'Contents', 'Info.plist'), 'w', encoding='utf-8') as f:
        f.write(plist)

    # 5. 生成 .icns 图标
    print("[5/5] 生成应用图标 .icns...")
    png_sizes = {
        16: ICON_PNG_16,
        32: ICON_PNG_32,
        64: ICON_PNG_64,
        128: ICON_PNG_128,
        256: ICON_PNG_256,
        512: ICON_PNG_512,
    }
    icns_data = build_icns(png_sizes)
    if icns_data:
        icns_dst = os.path.join(OUTPUT, 'Contents', 'Resources', 'icon.icns')
        with open(icns_dst, 'wb') as f:
            f.write(icns_data)
        # 移除默认的 electron.icns
        default_icns = os.path.join(OUTPUT, 'Contents', 'Resources', 'electron.icns')
        if os.path.exists(default_icns):
            os.remove(default_icns)
        print(f"  ✓ icon.icns ({len(icns_data)} bytes)")
    else:
        print("  ⚠️ 图标生成失败")

    print()
    print("=" * 50)
    print(f"  ✓ 构建完成: {OUTPUT}")
    print("=" * 50)

    # 显示大小
    total_size = 0
    for root, dirs, files in os.walk(OUTPUT):
        for f in files:
            fp = os.path.join(root, f)
            total_size += os.path.getsize(fp)
    print(f"  大小: {total_size / 1024 / 1024:.1f} MB")


if __name__ == '__main__':
    main()