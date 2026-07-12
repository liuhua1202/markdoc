"""
生成全套新图标：从用户上传的 1024x1024 jpg 出发
1) 找到圆角矩形有效区域,裁掉白边
2) 输出到 5 个目标位置:
   - root/icons/icon-192.png, icon-512.png        (PWA)
   - root/logo.svg, logo.ico                       (Web + Windows 安装包)
   - android-app/app/src/main/assets/icons/icon-192.png, icon-512.png
   - android-app/app/src/main/assets/logo.svg
   - android-app/app/src/main/res/mipmap-*/ic_launcher.png, ic_launcher_round.png (5 档 x 2)
3) logo.svg 是重新绘制的矢量版本(复刻上传图的视觉)
"""
from PIL import Image
import os
import struct

SRC = r'C:\聊天记录\微信\xwechat_files\lh-84739882_7c6d\temp\RWTemp\2026-07\474cbcdd7e438686777a45aa2ec4534c.jpg'
ROOT = r'C:\Users\liuhua\Desktop\Github\markdown'

# ---------- 1) 加载并裁剪 ----------
img = Image.open(SRC).convert('RGB')
print('original:', img.size, img.mode)

# 找有效圆角区域: 黑色像素构成圆角矩形,白色 padding 在四周
# 取第一行 / 最后一行有黑色像素的 y 范围
def find_content_box(im):
    pixels = im.load()
    w, h = im.size
    min_x, min_y, max_x, max_y = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            r, g, b = pixels[x, y]
            if r < 128 and g < 128 and b < 128:  # 黑色像素
                if x < min_x: min_x = x
                if x > max_x: max_x = x
                if y < min_y: min_y = y
                if y > max_y: max_y = y
    return min_x, min_y, max_x, max_y

bbox = find_content_box(img)
print('content bbox:', bbox)
cropped = img.crop(bbox)
print('cropped:', cropped.size)

# ---------- 2) 写 ico ----------
def make_ico(images_with_sizes, out_path):
    """images_with_sizes: list of (size_int, PIL.Image)。保存多尺寸 ico"""
    pngs = []
    for size, im in images_with_sizes:
        buf = io.BytesIO()
        im.save(buf, format='PNG', optimize=True)
        pngs.append((size, buf.getvalue()))
    # ICO header
    n = len(pngs)
    out = bytearray()
    # ICONDIR
    out += struct.pack('<HHH', 0, 1, n)
    # ICONDIRENTRY (offset later)
    entries_size = 6 + n * 16
    offset = entries_size
    for size, data in pngs:
        if size >= 256:
            w_b = 0
        else:
            w_b = size
        out += struct.pack('<BBBBHHII',
            w_b, w_b, 0, 0, 1, 32, len(data), offset)
        offset += len(data)
    for _, data in pngs:
        out += data
    with open(out_path, 'wb') as f:
        f.write(out)
    print('wrote ico:', out_path, 'sizes:', [s for s, _ in pngs])

import io

# ---------- 3) 输出 PNG ----------
def resize_square(im, size, bg=(255,255,255,0)):
    """缩放到 size×size, 保持宽高比, 透明 padding"""
    im2 = im.copy()
    im2.thumbnail((size, size), Image.LANCZOS)
    canvas = Image.new('RGBA', (size, size), bg)
    canvas.paste(im2, ((size - im2.size[0]) // 2, (size - im2.size[1]) // 2), im2.convert('RGBA'))
    return canvas

targets = [
    # PWA / Web assets
    (192, os.path.join(ROOT, 'icons', 'icon-192.png')),
    (512, os.path.join(ROOT, 'icons', 'icon-512.png')),
    # android assets 同源
    (192, os.path.join(ROOT, 'android-app', 'app', 'src', 'main', 'assets', 'icons', 'icon-192.png')),
    (512, os.path.join(ROOT, 'android-app', 'app', 'src', 'main', 'assets', 'icons', 'icon-512.png')),
]

# Android mipmap 标准尺寸
android_sizes = {
    'mdpi': 48,
    'hdpi': 72,
    'xhdpi': 96,
    'xxhdpi': 144,
    'xxxhdpi': 192,
}
for dpi, size in android_sizes.items():
    targets.append((size, os.path.join(ROOT, 'android-app', 'app', 'src', 'main', 'res', f'mipmap-{dpi}', 'ic_launcher.png')))
    targets.append((size, os.path.join(ROOT, 'android-app', 'app', 'src', 'main', 'res', f'mipmap-{dpi}', 'ic_launcher_round.png')))

for size, path in targets:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    out = resize_square(cropped, size)
    out.save(path, 'PNG', optimize=True)
    print('wrote:', path, size, 'x', size)

# ---------- 4) logo.ico (多尺寸) ----------
ico_sizes = [16, 32, 48, 64, 128, 256]
ico_imgs = [(s, resize_square(cropped, s)) for s in ico_sizes]
make_ico(ico_imgs, os.path.join(ROOT, 'logo.ico'))

print('✅ PNG/ICO 生成完毕')

# ---------- 5) SVG (矢量版本) ----------
svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <!-- 圆角方形背景,黑底 -->
  <rect width="1024" height="1024" rx="200" ry="200" fill="#000000"/>

  <!-- 白色文档卡片(主体左偏上,给放大镜留位置) -->
  <g transform="translate(132 178)">
    <!-- 文档主体 -->
    <path d="M0 96 Q0 0 96 0 L504 0 L660 156 L660 612 Q660 708 564 708 L96 708 Q0 708 0 612 Z" fill="#FFFFFF"/>
    <!-- 折角三角 -->
    <path d="M504 0 L660 156 L504 156 Z" fill="#D8D8D8"/>
    <!-- M 字母 (粗体) - 用 path -->
    <path d="M120 460 L120 240 L210 240 L330 380 L450 240 L540 240 L540 460 L470 460 L470 340 L350 470 L310 470 L190 340 L190 460 Z" fill="#000000"/>
  </g>

  <!-- 放大镜 (右下,半透明白圈+黑镜身+白高光) -->
  <g transform="translate(560 560)">
    <!-- 镜身外圆 -->
    <circle cx="140" cy="140" r="180" fill="none" stroke="#FFFFFF" stroke-width="46"/>
    <!-- 镜身内填充半透明黑,营造透出背景的效果 -->
    <circle cx="140" cy="140" r="155" fill="#000000" fill-opacity="0.0"/>
    <!-- 把手 -->
    <line x1="275" y1="275" x2="430" y2="430" stroke="#FFFFFF" stroke-width="60" stroke-linecap="round"/>
    <!-- 高光小点 -->
    <circle cx="80" cy="80" r="22" fill="#FFFFFF" fill-opacity="0.85"/>
  </g>
</svg>
'''
with open(os.path.join(ROOT, 'logo.svg'), 'w', encoding='utf-8') as f:
    f.write(svg)
# 同步到 android assets
with open(os.path.join(ROOT, 'android-app', 'app', 'src', 'main', 'assets', 'logo.svg'), 'w', encoding='utf-8') as f:
    f.write(svg)
print('✅ SVG 已写入 root/logo.svg + android assets')