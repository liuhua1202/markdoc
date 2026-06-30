"""
生成马克档 Android 启动图标 PNG（兼容 Android 7.x 及以下）
依赖：PIL/Pillow（项目已安装）
"""
from PIL import Image, ImageDraw, ImageFilter
import os

# 品牌色
BG_DARK = (26, 24, 41, 255)         # #1A1829
CARD_LIGHT = (253, 252, 247, 255)   # #FDFCF7
CARD_FOLD = (226, 222, 222, 255)    # #E2DEDE
BRAND_RED = (255, 90, 95, 255)      # #FF5A5F
DECOR_GRAY = (208, 205, 214, 255)   # #D0CDD6

# 输出目录（已存在）
BASE = r"C:\Users\liuhua\Desktop\Github\markdown\android-app\app\src\main\res"

# 各密度的尺寸
DENSITIES = {
    "mipmap-mdpi":    48,
    "mipmap-hdpi":    72,
    "mipmap-xhdpi":   96,
    "mipmap-xxhdpi":  144,
    "mipmap-xxxhdpi": 192,
}


def rounded_rect(draw, xy, radius, fill):
    """绘制圆角矩形"""
    draw.rounded_rectangle(xy, radius=radius, fill=fill)


def draw_m_letter(draw, cx, cy, w, h, color, stroke_w):
    """在画布中心绘制粗体 M（基于矢量路径，缩放到目标尺寸）"""
    # 原 SVG viewBox 1024，路径点 330,620 → 410,410 → 512,510 → 614,410 → 694,620
    # 缩放到画布
    scale = w / 1024
    points = [(330, 620), (410, 410), (512, 510), (614, 410), (694, 620)]
    pts = [(int(x * scale) + cx, int(y * scale) + cy) for x, y in points]
    draw.line(pts, fill=color, width=stroke_w, joint="curve")


def draw_hash(draw, x, y, size, color, alpha=153):
    """绘制一个 # 符号"""
    overlay = Image.new("RGBA", draw.im.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    w = size // 6
    # 横线两条
    od.rectangle([x - size // 2, y - w // 2, x + size // 2, y + w // 2], fill=color[:3] + (alpha,))
    od.rectangle([x - size // 2, y + w, x + size // 2, y + w + w], fill=color[:3] + (alpha,))
    # 竖线两条
    od.rectangle([x - w // 2, y - size // 2, x + w // 2, y + size // 2], fill=color[:3] + (alpha,))
    od.rectangle([x + w, y - size // 2, x + w + w, y + size // 2], fill=color[:3] + (alpha,))
    draw._image.alpha_composite(overlay)


def render_icon(size, rounded=False):
    """渲染一张图标 PNG"""
    # 4x 超采样抗锯齿
    SCALE = 4
    s = size * SCALE
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    if rounded:
        # 圆形图标：先画圆形背景
        draw.ellipse([0, 0, s, s], fill=BG_DARK)
        # 内容裁剪到圆形内
        mask = Image.new("L", (s, s), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, s, s], fill=255)
    else:
        # 圆角方形（圆角比例按 Android adaptive icon 标准）
        radius = int(s * 0.225)  # 接近 225/1024
        draw.rounded_rectangle([0, 0, s, s], radius=radius, fill=BG_DARK)
        mask = Image.new("L", (s, s), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, s, s], radius=radius, fill=255)

    # 在 mask 上绘制内容
    content = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    cd = ImageDraw.Draw(content)

    # 白色文档卡片（去掉底部边缘一些，留出 M 的下沿空间）
    card_pad = int(s * 0.21)  # 212/1024
    card_radius = int(s * 0.047)  # 48/1024
    card_top = int(s * 0.26)
    card_bottom = int(s * 0.74)
    cd.rounded_rectangle(
        [card_pad, card_top, s - card_pad, card_bottom],
        radius=card_radius,
        fill=CARD_LIGHT
    )

    # 折页阴影
    fold = [(int(s * 0.695), int(s * 0.26)),
            (int(s * 0.795), int(s * 0.355)),
            (int(s * 0.795), int(s * 0.74)),
            (int(s * 0.21), int(s * 0.74)),
            (int(s * 0.21), int(s * 0.26))]
    cd.polygon(fold, fill=(240, 238, 245, 128))

    # 折页三角
    tri = [(int(s * 0.695), int(s * 0.26)),
           (int(s * 0.695), int(s * 0.355)),
           (int(s * 0.795), int(s * 0.355))]
    cd.polygon(tri, fill=CARD_FOLD)

    # M 字母
    m_stroke = int(s * 0.0625)  # 64/1024
    draw_m_letter(cd, 0, 0, s, s, BRAND_RED, m_stroke)

    # 两个 # 装饰（左下角）
    hash_size = int(s * 0.05)
    hash_y = int(s * 0.685)
    draw_hash(cd, int(s * 0.275), hash_y, hash_size, DECOR_GRAY, alpha=153)
    draw_hash(cd, int(s * 0.335), hash_y, hash_size, DECOR_GRAY, alpha=153)

    # 应用 mask
    content.putalpha(Image.eval(content.split()[3], lambda v: v) if False else content.split()[3])
    img.paste(content, (0, 0), content)

    if rounded:
        # 裁剪为圆形
        out = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        out.paste(img, (0, 0), mask)
        img = out

    # 缩小回目标尺寸（高质量）
    final = img.resize((size, size), Image.LANCZOS)
    return final


# 为每个密度生成普通图标和圆形图标
for folder, sz in DENSITIES.items():
    out_dir = os.path.join(BASE, folder)
    os.makedirs(out_dir, exist_ok=True)
    render_icon(sz, rounded=False).save(os.path.join(out_dir, "ic_launcher.png"))
    render_icon(sz, rounded=True).save(os.path.join(out_dir, "ic_launcher_round.png"))
    print(f"  ✓ {folder}/ic_launcher.png + ic_launcher_round.png ({sz}x{sz})")

print("\n🎉 All PNG icons generated.")