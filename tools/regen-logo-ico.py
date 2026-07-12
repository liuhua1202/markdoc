"""
regen-logo-ico.py — 从 logo.svg 重新生成 logo.ico 和 desktop-app/build/icon.ico

为什么不用 cairosvg / svglib:本机没装,而且 logo.svg 简单到手动画就行
(rounded square bg + doc card + fold + M letter),无外部依赖。
"""
import io
import os
import struct
from PIL import Image, ImageDraw


VB = 1024  # SVG viewport


def _parse_card(s: float):
    """SVG path 'M182 206 L686 206 L842 362 L842 768 Q842 818 792 818 L232 818 Q182 818 182 768 Z'
    返回 (corners, corner_radius) — corners 顺序: top-left, top-right(折角前), fold, right, br, bl, left(不含圆角顶点)。"""
    # 这里我们直接 hard-code 解析后的关键点(与 v1.0.14 logo.svg / ic_launcher_foreground.xml 同步)
    return {
        "top_left":      (182, 206),
        "top_straight":  (686, 206),  # 折角起点
        "fold":          (842, 362),  # 折角
        "right_straight":(842, 768),  # 右下圆角前
        "right_bot":     (792, 818),  # 右下圆角后
        "left_bot":      (232, 818),  # 左下圆角后
        "left_straight": (182, 768),  # 左下圆角前
        "corner_r":      50,
    }


def _parse_fold(s: float):
    return [
        (616 * s, 304 * s),
        (710 * s, 398 * s),
        (616 * s, 398 * s),
    ]


def _parse_m(s: float):
    # 与 ic_launcher_foreground.xml v1.0.14 一致
    return [
        (386 * s, 630.5 * s),
        (386 * s, 446.5 * s),
        (440 * s, 446.5 * s),
        (512 * s, 531.5 * s),
        (584 * s, 446.5 * s),
        (638 * s, 446.5 * s),
        (638 * s, 630.5 * s),
        (596 * s, 630.5 * s),
        (596 * s, 509.5 * s),
        (530 * s, 583.5 * s),
        (494 * s, 583.5 * s),
        (428 * s, 509.5 * s),
        (428 * s, 630.5 * s),
    ]


def _parse_card_v(s: float):
    # 与 logo.svg v1.0.14 一致(尺寸不同,但坐标与 Android 一样)
    return {
        "corners": [
            (182 * s, 206 * s),
            (686 * s, 206 * s),
            (842 * s, 362 * s),
            (842 * s, 768 * s),
            (792 * s, 818 * s),
            (232 * s, 818 * s),
            (182 * s, 768 * s),
        ],
        "corner_r": 50 * s,
    }


def _parse_fold_v(s: float):
    return [
        (686 * s, 206 * s),
        (842 * s, 362 * s),
        (686 * s, 362 * s),
    ]


def _parse_m_v(s: float):
    return [
        (302 * s, 682 * s),
        (302 * s, 372 * s),
        (392 * s, 372 * s),
        (512 * s, 512 * s),
        (632 * s, 372 * s),
        (722 * s, 372 * s),
        (722 * s, 682 * s),
        (652 * s, 682 * s),
        (652 * s, 472 * s),
        (532 * s, 602 * s),
        (492 * s, 602 * s),
        (372 * s, 472 * s),
        (372 * s, 682 * s),
    ]


def render_logo_android(size: int) -> Image.Image:
    """Android 前景层(无背景,透明)— mipmap 用"""
    s = size / VB
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # 文档卡片(用 polygon,跳过圆角 — Android 启动器会自己用 ic_launcher_background 圆角)
    d.polygon([
        (314 * s, 304 * s),
        (616 * s, 304 * s),
        (710 * s, 398 * s),
        (710 * s, 720 * s),
        (660 * s, 720 * s),
        (364 * s, 720 * s),
        (314 * s, 670 * s),
    ], fill=(255, 255, 255, 255))
    # 折角
    d.polygon(_parse_fold(s), fill=(216, 216, 216, 255))
    # M 字母
    d.polygon(_parse_m(s), fill=(0, 0, 0, 255))
    return img


def render_logo(size: int, with_bg: bool = True) -> Image.Image:
    """完整 logo(黑底圆角 + 卡片 + 折角 + M)— logo.ico / PWA 用"""
    s = size / VB
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if with_bg:
        # 黑色圆角方形背景(rx=200)
        d.rounded_rectangle(
            [0, 0, size - 1, size - 1],
            radius=int(200 * s),
            fill=(0, 0, 0, 255),
        )
    # 文档卡片 — 7 顶点 polygon,圆角 50 在 1024 视觉上几乎看不出,直接 sharp
    # (避免 polygon + circle 修补的"耳朵"问题)
    card_corners = _parse_card_v(s)["corners"]
    d.polygon(card_corners, fill=(255, 255, 255, 255))
    # 折角灰三角
    d.polygon(_parse_fold_v(s), fill=(216, 216, 216, 255))
    # M 字母
    d.polygon(_parse_m_v(s), fill=(0, 0, 0, 255))
    return img


def make_ico(images_with_sizes: list, out_path: str) -> None:
    pngs = []
    for size, im in images_with_sizes:
        buf = io.BytesIO()
        im.save(buf, format="PNG", optimize=True)
        pngs.append((size, buf.getvalue()))
    n = len(pngs)
    out = bytearray()
    out += struct.pack("<HHH", 0, 1, n)
    entries_size = 6 + n * 16
    offset = entries_size
    for size, data in pngs:
        w_b = 0 if size >= 256 else size
        out += struct.pack("<BBBBHHII", w_b, w_b, 0, 0, 1, 32, len(data), offset)
        offset += len(data)
    for _, data in pngs:
        out += data
    with open(out_path, "wb") as f:
        f.write(out)
    print(f"wrote ico: {out_path} sizes={[s for s, _ in pngs]}")


ROOT = r"C:\Users\liuhua\Desktop\Github\markdown"

# 1) logo.ico — 多尺寸(含 256 适合 Win10/11 任务栏)
ico_sizes = [16, 32, 48, 64, 128, 256]
ico_imgs = [(s, render_logo(s, with_bg=True)) for s in ico_sizes]
make_ico(ico_imgs, os.path.join(ROOT, "logo.ico"))
# desktop-app/build/icon.ico(electron-builder 用的,同名)
make_ico(ico_imgs, os.path.join(ROOT, "desktop-app", "build", "icon.ico"))

# 2) 大尺寸主 PNG 备用
master = render_logo(1024, with_bg=True)
master.save(os.path.join(ROOT, "logo.png"), "PNG", optimize=True)
print(f"wrote png: {os.path.join(ROOT, 'logo.png')}")

# 3) 同步 desktop build/ 下的 PNG(electron-builder 也读这些)
for size in (16, 32, 48, 64, 128, 256, 512):
    p = os.path.join(ROOT, "desktop-app", "build", f"icon-{size}.png")
    render_logo(size, with_bg=True).save(p, "PNG", optimize=True)
print("wrote desktop-app/build/icon-{16,32,48,64,128,256,512}.png")

print("✅ logo.ico + desktop icon.ico + logo.png + desktop build icons 已重新生成")
