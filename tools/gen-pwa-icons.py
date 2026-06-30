"""
为 PWA 生成 192/512 PNG 图标
复用与 Android 一致的设计（深色圆角方形 + M 字母 + # 装饰）
"""
from PIL import Image, ImageDraw
import os

BG_DARK = (26, 24, 41, 255)
CARD_LIGHT = (253, 252, 247, 255)
CARD_FOLD = (226, 222, 222, 255)
BRAND_RED = (255, 90, 95, 255)
DECOR_GRAY = (208, 205, 214, 255)

OUT_DIR = r"C:\Users\liuhua\Desktop\Github\markdown\icons"
os.makedirs(OUT_DIR, exist_ok=True)

def render(size):
    SCALE = 4
    s = size * SCALE
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    radius = int(s * 0.225)
    draw.rounded_rectangle([0, 0, s, s], radius=radius, fill=BG_DARK)

    # 白色卡片
    card_pad = int(s * 0.21)
    card_top = int(s * 0.26)
    card_bottom = int(s * 0.74)
    draw.rounded_rectangle(
        [card_pad, card_top, s - card_pad, card_bottom],
        radius=int(s * 0.047),
        fill=CARD_LIGHT
    )

    # 折页
    tri = [(int(s * 0.695), int(s * 0.26)),
           (int(s * 0.695), int(s * 0.355)),
           (int(s * 0.795), int(s * 0.355))]
    draw.polygon(tri, fill=CARD_FOLD)

    # M 字母
    pts = [(int(330/1024*s), int(620/1024*s)),
           (int(410/1024*s), int(410/1024*s)),
           (int(512/1024*s), int(510/1024*s)),
           (int(614/1024*s), int(410/1024*s)),
           (int(694/1024*s), int(620/1024*s))]
    draw.line(pts, fill=BRAND_RED, width=int(s*0.0625), joint="curve")

    # # 装饰（两个）
    def draw_hash(cx, cy, hsz, alpha=153):
        overlay = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        od = ImageDraw.Draw(overlay)
        w = hsz // 6
        color = (*DECOR_GRAY[:3], alpha)
        # 横线
        od.rectangle([cx - hsz//2, cy - w//2, cx + hsz//2, cy + w//2], fill=color)
        od.rectangle([cx - hsz//2, cy + w, cx + hsz//2, cy + w + w], fill=color)
        # 竖线
        od.rectangle([cx - w//2, cy - hsz//2, cx + w//2, cy + hsz//2], fill=color)
        od.rectangle([cx + w, cy - hsz//2, cx + w + w, cy + hsz//2], fill=color)
        img.alpha_composite(overlay)

    draw_hash(int(s * 0.275), int(s * 0.685), int(s * 0.05))
    draw_hash(int(s * 0.335), int(s * 0.685), int(s * 0.05))

    return img.resize((size, size), Image.LANCZOS)

for sz in [192, 512]:
    out = os.path.join(OUT_DIR, f"icon-{sz}.png")
    render(sz).save(out)
    print(f"  ✓ {out} ({sz}x{sz})")

print("✓ PWA 图标生成完成")