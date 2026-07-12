"""
v1.0.11 图标修复后渲染对比图。

输出:
  - 5 种启动器形状(圆/圆角方形/方/泪滴/squircle)下的最终图标
  - Android 13+ 主题图标(monochrome 模式)在 3 种主题色下的效果
  - 旧 vs 新对比
"""
from PIL import Image, ImageDraw
import xml.etree.ElementTree as ET
import os
import math
import re

OUT = r"C:\Users\liuhua\Desktop\Github\markdown\android-app\tools\icon-preview"
os.makedirs(OUT, exist_ok=True)

# ===== 工具函数 =====

def _get_attr(a, name):
    return (
        a.get(f"android:{name}")
        or a.get(name)
        or a.get(f"{{http://schemas.android.com/apk/res/android}}{name}")
    )


def _parse_color(c, alpha=1.0):
    c = (c or "").strip()
    if c.startswith("#"):
        h = c[1:]
        if len(h) == 6:
            return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), int(255 * alpha))
        if len(h) == 8:
            return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), int(h[6:8], 16))
    return (0, 0, 0, int(255 * alpha))


def _path_polylines(d):
    """支持 M/L/Q/Z 全大写绝对命令。Q 离散成 24 段折线。"""
    tokens = re.findall(r"[MLQZ]|-?\d+(?:\.\d+)?", d)
    i = 0
    cur = (0.0, 0.0)
    start = (0.0, 0.0)
    pts = []
    subpaths = []
    last_cmd = None
    while i < len(tokens):
        t = tokens[i]
        if t in "MLQZ":
            cmd = t
            i += 1
        else:
            cmd = last_cmd
        if cmd == "M":
            cur = (float(tokens[i]), float(tokens[i + 1]))
            start = cur
            pts = [cur]
            i += 2
            last_cmd = "L"
        elif cmd == "L":
            cur = (float(tokens[i]), float(tokens[i + 1]))
            pts.append(cur)
            i += 2
        elif cmd == "Q":
            cx, cy = float(tokens[i]), float(tokens[i + 1])
            ex, ey = float(tokens[i + 2]), float(tokens[i + 3])
            for s in range(1, 25):
                tt = s / 24
                u = 1 - tt
                x = u * u * cur[0] + 2 * u * tt * cx + tt * tt * ex
                y = u * u * cur[1] + 2 * u * tt * cy + tt * tt * ey
                pts.append((x, y))
            cur = (ex, ey)
            i += 4
        elif cmd == "Z":
            if pts and pts[-1] != start:
                pts.append(start)
            subpaths.append(pts)
            pts = []
            cur = start
            last_cmd = None
    if pts:
        subpaths.append(pts)
    return subpaths


def render_vector(xml_path, size, viewport=1024, fill_alpha_global=1.0):
    """渲染 vector drawable 到 size x size 图像。

    Args:
        xml_path: vector drawable XML 路径
        size: 输出尺寸
        viewport: 源 viewport 尺寸(默认 1024)
        fill_alpha_global: 全局 fill alpha 缩放(monochrome 测试时降到 0.5)
    """
    tree = ET.parse(xml_path)
    root = tree.getroot()
    scale = size / viewport

    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    for el in root:
        tag = el.tag.split("}")[-1]
        if tag != "path":
            continue
        a = el.attrib
        pd = _get_attr(a, "pathData") or a.get("d", "")
        subpaths = _path_polylines(pd)

        fc_raw = _get_attr(a, "fillColor")
        sc_raw = _get_attr(a, "strokeColor")
        sw_str = _get_attr(a, "strokeWidth")
        sw = float(sw_str) if sw_str else 0
        fill_alpha = float(_get_attr(a, "fillAlpha") or 1.0)
        fill_type = _get_attr(a, "fillType") or "nonZero"
        effective_alpha = fill_alpha * fill_alpha_global

        fc = None if (fc_raw and fc_raw.lower() == "#00000000") else fc_raw
        if fc and effective_alpha < 1.0:
            r, g, b, _ = _parse_color(fc)
            fc_color = (r, g, b, int(255 * effective_alpha))
        else:
            fc_color = _parse_color(fc) if fc else None

        for sp in subpaths:
            pts = [(p[0] * scale, p[1] * scale) for p in sp]
            n_pts = len(pts)

            # 圆环检测
            is_circle = fc is None and sc_raw and sw > 0 and n_pts >= 12 and pts[0] == pts[-1]
            if is_circle:
                xs = [p[0] for p in pts[:-1]]
                ys = [p[1] for p in pts[:-1]]
                cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
                rx, ry = (max(xs) - min(xs)) / 2, (max(ys) - min(ys)) / 2
                d.ellipse(
                    [cx - rx, cy - ry, cx + rx, cy + ry],
                    outline=_parse_color(sc_raw),
                    width=max(1, int(sw * scale)),
                )
                continue

            is_line = fc is None and sc_raw and sw > 0 and n_pts == 2
            if is_line:
                d.line(pts, fill=_parse_color(sc_raw),
                       width=max(1, int(sw * scale)), joint="curve")
                continue

            if fc_color and n_pts >= 3:
                d.polygon(pts, fill=fc_color)
            if sc_raw and sw > 0 and n_pts >= 2:
                d.line(pts, fill=_parse_color(sc_raw),
                       width=max(1, int(sw * scale)), joint="curve")

    return img


def make_mask(size, shape):
    """生成启动器形状遮罩。"""
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    if shape == "circle":
        md.ellipse([0, 0, size - 1, size - 1], fill=255)
    elif shape == "rounded-square":
        radius = int(size * 0.22)
        md.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    elif shape == "square":
        md.rectangle([0, 0, size - 1, size - 1], fill=255)
    elif shape == "squircle":
        radius = int(size * 0.40)
        md.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    elif shape == "teardrop":
        md.ellipse([0, 0, size - 1, int(size * 0.85)], fill=255)
        md.polygon([(0, int(size * 0.55)),
                    (size - 1, int(size * 0.55)),
                    (size // 2, size - 1)], fill=255)
    return mask


def apply_mask(img, mask):
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


# ===== 1. 渲染 Android 8+ 自适应图标(背景+前景) =====
FG = r"C:\Users\liuhua\Desktop\Github\markdown\android-app\app\src\main\res\drawable\ic_launcher_foreground.xml"
BG = r"C:\Users\liuhua\Desktop\Github\markdown\android-app\app\src\main\res\drawable\ic_launcher_background.xml"

def make_layered(size=1024):
    """画背景(纯黑圆角矩形,模拟 ic_launcher_background.xml)+ 前景"""
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bg)
    # 背景是黑色,Android 会按 adaptive-icon 规范画到 108dp viewport 的全屏
    # 启动器在它上面叠 mask。这里模拟"未蒙版"的完整 108dp 图层
    radius = int(size * 0.22)
    bd.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=(0, 0, 0, 255))
    fg = render_vector(FG, size, fill_alpha_global=1.0)
    layered = Image.alpha_composite(bg, fg)
    return layered


# 渲染到 1024 看大图
layered = make_layered(1024)
layered.save(os.path.join(OUT, "v12-01-layered-raw.png"))

# 5 种启动器形状
for shape in ["circle", "rounded-square", "squircle", "square", "teardrop"]:
    mask = make_mask(1024, shape)
    out = apply_mask(layered, mask)
    out.save(os.path.join(OUT, f"v12-02-launcher-{shape}.png"))

# ===== 2. monochrome 主题图标(Android 13+) =====
MO = r"C:\Users\liuhua\Desktop\Github\markdown\android-app\app\src\main\res\drawable\ic_launcher_monochrome.xml"

def make_themed_icon(mono_xml, theme_color, size=512, shape="rounded-square"):
    """模拟 Android 13+ 主题图标:
       - 背景 = 系统主题色(启动器提供)
       - 前景 = monochrome 的 alpha mask,用主题色填充
       - 形状 = 启动器形状(圆/圆角方形)
       MIUI 实际效果: monochrome 镂空的部分会显示系统主题背景色
                     (背景色和前景色相同 → 看不出 M 形状)
       Pixel 实际效果: 背景色通常是主题色 + ~30% 亮度,前景是主题色
                     → M 形状"挖空"处显示浅色背景,前景显示深色主题色
    """
    # 渲染 monochrome(全屏,带 alpha)
    mono = render_vector(mono_xml, size, fill_alpha_global=1.0)
    # 把单色层变成"主题色前景"
    fg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    fp = fg.load()
    mp = mono.load()
    for y in range(size):
        for x in range(size):
            r, g, b, a = mp[x, y]
            if a > 0:
                fp[x, y] = (theme_color[0], theme_color[1], theme_color[2], a)
    # 背景
    bg = Image.new("RGBA", (size, size), theme_color + (255,))
    out = Image.alpha_composite(bg, fg)
    # 形状遮罩
    mask = make_mask(size, shape)
    out.putalpha(mask)
    return out


def make_themed_icon_pixel_style(mono_xml, theme_color, size=512, shape="rounded-square"):
    """Pixel 风格的 themed icon:背景是浅色变体,前景是主题色实心
    (模拟 Android 13+ Pixel Launcher 行为,MIUI 不一定这样)"""
    mono = render_vector(mono_xml, size, fill_alpha_global=1.0)
    # 浅色背景(主题色 + 30% 亮度近似)
    light_bg = tuple(min(255, int(c + (255 - c) * 0.65)) for c in theme_color)
    bg = Image.new("RGBA", (size, size), light_bg + (255,))
    fg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    fp = fg.load()
    mp = mono.load()
    for y in range(size):
        for x in range(size):
            r, g, b, a = mp[x, y]
            if a > 0:
                fp[x, y] = (theme_color[0], theme_color[1], theme_color[2], a)
    out = Image.alpha_composite(bg, fg)
    mask = make_mask(size, shape)
    out.putalpha(mask)
    return out


# 红色主题(默认 brand_red)
brand_red = (0xFF, 0x5A, 0x5F)
# 蓝色主题(MIUI/HyperOS 蓝)
miui_blue = (0x1A, 0x73, 0xE8)
# 紫色主题(Pixel 主题图标常用)
pixel_purple = (0x67, 0x52, 0xEA)

for theme_name, theme_color in [
    ("brand-red", brand_red),
    ("miui-blue", miui_blue),
    ("pixel-purple", pixel_purple),
]:
    for shape in ["circle", "rounded-square"]:
        # MIUI 风格:背景 = 主题色(同色)→ M 挖空看不出来
        out_miui = make_themed_icon(MO, theme_color, size=512, shape=shape)
        out_miui.save(os.path.join(OUT, f"v12-03-themed-{theme_name}-{shape}.png"))
        # Pixel 风格:背景 = 浅色变体,前景 = 主题色 → M 挖空能看出来
        out_pixel = make_themed_icon_pixel_style(MO, theme_color, size=512, shape=shape)
        out_pixel.save(os.path.join(OUT, f"v12-03b-themed-pixelstyle-{theme_name}-{shape}.png"))

# ===== 3. 对比图: 5 种启动器形状 =====
def combine(images, cols, gap=20, bg=(255, 255, 255, 255)):
    if not images:
        return None
    rows = (len(images) + cols - 1) // cols
    w = max(im.width for im in images) + gap
    h = max(im.height for im in images) + gap
    canvas = Image.new("RGBA", (w * cols - gap, h * rows - gap), bg)
    for i, im in enumerate(images):
        r, c = i // cols, i % cols
        if im.mode == "RGBA":
            canvas.paste(im, (c * w, r * h), im)
        else:
            canvas.paste(im, (c * w, r * h))
    return canvas


# 启动器形状 5 合一
shapes = ["circle", "rounded-square", "squircle", "square", "teardrop"]
launcher_imgs = [Image.open(os.path.join(OUT, f"v12-02-launcher-{s}.png")) for s in shapes]
combined_launchers = combine(launcher_imgs, 3)
combined_launchers.save(os.path.join(OUT, "v12-04-launcher-comparison.png"))

# 主题图标 6 合一(3 主题色 × 2 形状)—— MIUI 风格
themed_imgs = []
for theme_name in ["brand-red", "miui-blue", "pixel-purple"]:
    for shape in ["circle", "rounded-square"]:
        themed_imgs.append(Image.open(os.path.join(OUT, f"v12-03-themed-{theme_name}-{shape}.png")))
combined_themed = combine(themed_imgs, 3)
combined_themed.save(os.path.join(OUT, "v12-05-themed-comparison.png"))

# 主题图标 6 合一 —— Pixel 风格
themed_pixel_imgs = []
for theme_name in ["brand-red", "miui-blue", "pixel-purple"]:
    for shape in ["circle", "rounded-square"]:
        themed_pixel_imgs.append(Image.open(os.path.join(OUT, f"v12-03b-themed-pixelstyle-{theme_name}-{shape}.png")))
combined_pixel = combine(themed_pixel_imgs, 3)
combined_pixel.save(os.path.join(OUT, "v12-05b-themed-pixel-comparison.png"))

# ===== 4. 安全区验证(在 108dp 画布上画 66dp 安全圆) =====
def safe_area_overlay(size=432):
    canvas = render_vector(FG, size)
    sd = ImageDraw.Draw(canvas)
    r = int(size * (66.0 / 108.0) / 2)
    center = (size // 2, size // 2)
    sd.ellipse([center[0] - r, center[1] - r, center[0] + r, center[1] + r],
               outline=(0, 255, 0, 255), width=3)
    canvas.save(os.path.join(OUT, "v12-06-safe-area.png"))


safe_area_overlay()

# ===== 5. 旧 vs 新 对比(同 1024 形状) =====
def compare_old_new():
    """旧版:用 v1.0.10 缩放前的版本(原始 logo.svg,会越出安全区)
       新版:用 v1.0.11(在安全区内)"""
    import sys
    sys.path.insert(0, r"C:\Users\liuhua\Desktop\Github\markdown\android-app\tools")
    if "regen_mipmaps" in sys.modules:
        del sys.modules["regen_mipmaps"]
    import regen_mipmaps

    old_img = regen_mipmaps.render_fg_xml(
        FG, 1024, bg_color=(0, 0, 0, 255), bg_rounded=True
    )
    old_img.save(os.path.join(OUT, "v12-07-current-1024.png"))


compare_old_new()

print("All renders done. Output:", OUT)
for f in sorted(os.listdir(OUT)):
    if f.startswith("v12-") or f.startswith("99-"):
        print("  -", f)
