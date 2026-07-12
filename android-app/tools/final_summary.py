"""
最终交付对比图 —— v1.0.12 简化版(去掉放大镜)。
"""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = r"C:\Users\liuhua\Desktop\Github\markdown\android-app\tools\icon-preview"

def load(p):
    return Image.open(os.path.join(OUT, p))

# 加载 5 种启动器形状图
launcher_imgs = [
    load("v12-02-launcher-circle.png"),
    load("v12-02-launcher-rounded-square.png"),
    load("v12-02-launcher-squircle.png"),
    load("v12-02-launcher-square.png"),
    load("v12-02-launcher-teardrop.png"),
]
# 加载 3 种主题色 themed 图标(MIUI 风格,一坨色块)
themed_miui = [
    load("v12-03-themed-brand-red-circle.png"),
    load("v12-03-themed-miui-blue-circle.png"),
    load("v12-03-themed-pixel-purple-circle.png"),
]
# 加载 3 种主题色 themed 图标(Pixel 风格,主题色文档)
themed_pixel = [
    load("v12-03b-themed-pixelstyle-brand-red-circle.png"),
    load("v12-03b-themed-pixelstyle-miui-blue-circle.png"),
    load("v12-03b-themed-pixelstyle-pixel-purple-circle.png"),
]
# 单 mipmap PNG
mipmap_192 = load("v12-07-current-1024.png").resize((384, 384), Image.LANCZOS)

# ===== 拼图 =====
W = 384
H = 384
GAP = 24
PAD = 32
TITLE_H = 40

def tile(im):
    return im.resize((W, H), Image.LANCZOS)

def section(title, imgs, sub):
    n = len(imgs)
    sec_w = PAD * 2 + W * n + GAP * (n - 1)
    sec_h = TITLE_H + H + 60  # title + images + sub label

    canvas = Image.new("RGBA", (sec_w, sec_h), (255, 255, 255, 255))
    d = ImageDraw.Draw(canvas)

    # 标题
    try:
        font_t = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 22)
        font_s = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 14)
    except Exception:
        font_t = ImageFont.load_default()
        font_s = ImageFont.load_default()

    d.text((PAD, 8), title, fill=(20, 20, 20), font=font_t)
    d.text((PAD, TITLE_H + H + 6), sub, fill=(120, 120, 120), font=font_s)

    for i, im in enumerate(imgs):
        x = PAD + i * (W + GAP)
        y = TITLE_H
        canvas.paste(tile(im), (x, y))
    return canvas


# 合成 3 个 section
sec1 = section(
    "① 5 种启动器形状(Android 8+ 自适应图标)",
    launcher_imgs,
    "所有形状下 M 字母 + 文档 + 放大镜都完整在 66dp 安全区内",
)
sec2 = section(
    "② 主题图标 — MIUI 风格(同色背景/前景)",
    themed_miui,
    "MIUI 用同色填充 → 一坨主题色块(MIUI 自身行为)",
)
sec3 = section(
    "③ 主题图标 — Pixel 风格(浅色背景 + 主题色前景)",
    themed_pixel,
    "Pixel Launcher 上能正确显示: 主题色文档剪影",
)
sec4 = section(
    "④ 实际 mipmap-xxxhdpi(Android 7 fallback)",
    [mipmap_192],
    "192x192 在小米14 桌面看到的实际图标(放大后预览)",
)

# 拼上下
total_w = max(s.width for s in [sec1, sec2, sec3, sec4])
total_h = sum(s.height for s in [sec1, sec2, sec3, sec4]) + GAP * 3

final = Image.new("RGBA", (total_w, total_h), (255, 255, 255, 255))
y = 0
for s in [sec1, sec2, sec3, sec4]:
    final.paste(s, (0, y))
    y += s.height + GAP

# 加文件头
header_h = 80
final_with_header = Image.new("RGBA", (total_w, header_h + total_h), (255, 255, 255, 255))
final_with_header.paste(final, (0, header_h))
d = ImageDraw.Draw(final_with_header)
try:
    font_h = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 28)
    font_d = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 16)
except Exception:
    font_h = ImageFont.load_default()
    font_d = ImageFont.load_default()

d.text((PAD, 12), "马克档 v1.0.12 图标修复 — 全面检查 & 修复总结", fill=(20, 20, 20), font=font_h)
d.text((PAD, 48), "修复了 7 个 BUG:前景越界 / monochrome 复用 / mipmap 渲染 / IO 阻塞 / mixedContent / queries 缺失 / 浅色 splash 无 logo", fill=(80, 80, 80), font=font_d)

out = os.path.join(OUT, "v12-FINAL-summary.png")
final_with_header.save(out, "PNG", optimize=True)
print(f"saved {out}, size: {os.path.getsize(out)}B, {final_with_header.size}")
