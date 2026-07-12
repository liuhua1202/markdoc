"""
根据 ic_launcher_foreground.xml 重新生成 mipmap PNG(Android 7 fallback)。

修复历史:
  v1.0.11 - 重写 regen,修 3 个 bug:
    1) a.get("d") 改成 a.get("android:pathData")(Android 用 pathData,SVG 才是 d)
    2) 放大镜镜身/把手从 stroke 改成直接的圆/线形状
       旧版用 d.line + joint="curve" 画闭合折线 —— Pillow 的 line 不自动闭合,导致圆环缺口
    3) fillColor="#00000000" 透明 fill 时,polygon 改用 fill_color 局部变量(避免用原始 fc)
"""
from PIL import Image, ImageDraw
import os
import re

OUT_BASE = r"C:\Users\liuhua\Desktop\Github\markdown\android-app\app\src\main\res"

DPI_SIZES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}
VB = 1024


def _get_attr(a, name):
    """ElementTree 把 android:xxx 展开成 {ns}xxx,尝试两种 key。"""
    return (
        a.get(f"android:{name}")
        or a.get(name)
        or a.get(f"{{http://schemas.android.com/apk/res/android}}{name}")
    )


def _parse_color(c):
    c = (c or "").strip()
    if c.startswith("#"):
        h = c[1:]
        if len(h) == 6:
            return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)
        if len(h) == 8:
            return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), int(h[6:8], 16))
    return (0, 0, 0, 255)


def _path_polylines(d):
    """极简 path 解析,支持 M/L/Q/Z(全大写绝对命令)。Q 二次 Bezier 离散成 24 段。"""
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


def _circle_path(cx, cy, r, segs=48):
    """生成 32 段折线近似的圆 path(纯绝对命令)。"""
    pts = []
    for i in range(segs + 1):
        a = 2 * 3.141592653589793 * i / segs
        pts.append((cx + r * __import__("math").cos(a), cy + r * __import__("math").sin(a)))
    d = f"M{pts[0][0]:.2f},{pts[0][1]:.2f}"
    for p in pts[1:]:
        d += f" L{p[0]:.2f},{p[1]:.2f}"
    d += " Z"
    return d


def render_fg_xml(xml_path, size, bg_color=(0, 0, 0, 255), bg_rounded=True):
    """根据 vector drawable XML 渲染图标到 size x size 图像。

    关键修复:
      - 用 _get_attr 兼容 android: 命名空间
      - 透明 fill (#00000000) 不画 polygon
      - 描边圆形/线段改用 ImageDraw 原语(ellipse/line)而不是折线 polygon
    """
    import xml.etree.ElementTree as ET
    tree = ET.parse(xml_path)
    root = tree.getroot()

    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    scale = size / VB

    # 圆角背景
    if bg_rounded:
        radius = int(size * 0.22)
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=bg_color)
    else:
        d.rectangle([0, 0, size - 1, size - 1], fill=bg_color)

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
        linecap = _get_attr(a, "strokeLineCap") or "butt"

        fc = None if (fc_raw and fc_raw.lower() == "#00000000") else fc_raw

        for sp in subpaths:
            pts = [(p[0] * scale, p[1] * scale) for p in sp]

            # 智能判断: 圆环 + 仅描边 + 多段折线 → 用 ellipse
            n_pts = len(pts)
            is_approx_circle = (
                fc is None and sc_raw and sw > 0
                and n_pts >= 12
                and pts[0] == pts[-1]
            )
            if is_approx_circle:
                xs = [p[0] for p in pts[:-1]]
                ys = [p[1] for p in pts[:-1]]
                cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
                rx = (max(xs) - min(xs)) / 2
                ry = (max(ys) - min(ys)) / 2
                # 圆环
                d.ellipse(
                    [cx - rx, cy - ry, cx + rx, cy + ry],
                    outline=_parse_color(sc_raw),
                    width=max(1, int(sw * scale)),
                )
                continue

            # 智能判断: 直线段(2 个点) + 描边 → 直接 line
            is_line = (
                fc is None and sc_raw and sw > 0
                and n_pts == 2
            )
            if is_line:
                d.line(pts, fill=_parse_color(sc_raw), width=max(1, int(sw * scale)),
                       joint="curve")
                continue

            # 通用路径: 先 fill polygon,再 line
            if fc and n_pts >= 3:
                d.polygon(pts, fill=_parse_color(fc))
            if sc_raw and sw > 0 and n_pts >= 2:
                d.line(pts, fill=_parse_color(sc_raw), width=max(1, int(sw * scale)),
                       joint="curve")

    return img


# 渲染
FG = r"C:\Users\liuhua\Desktop\Github\markdown\android-app\app\src\main\res\drawable\ic_launcher_foreground.xml"

for dpi, size in DPI_SIZES.items():
    img = render_fg_xml(FG, size, bg_color=(0, 0, 0, 255), bg_rounded=True)
    p1 = os.path.join(OUT_BASE, f"mipmap-{dpi}", "ic_launcher.png")
    p2 = os.path.join(OUT_BASE, f"mipmap-{dpi}", "ic_launcher_round.png")
    img.save(p1, "PNG", optimize=True)
    img.save(p2, "PNG", optimize=True)
    print(f"  {dpi}: {size}x{size} -> {p1} ({os.path.getsize(p1)}B)")

# PWA 用
icons_dir = r"C:\Users\liuhua\Desktop\Github\markdown\icons"
img192 = render_fg_xml(FG, 192, bg_color=(0, 0, 0, 255), bg_rounded=True)
img192.save(os.path.join(icons_dir, "icon-192.png"), "PNG", optimize=True)
img512 = render_fg_xml(FG, 512, bg_color=(0, 0, 0, 255), bg_rounded=True)
img512.save(os.path.join(icons_dir, "icon-512.png"), "PNG", optimize=True)
print(f"  icons/icon-192.png: {os.path.getsize(os.path.join(icons_dir, 'icon-192.png'))}B")
print(f"  icons/icon-512.png: {os.path.getsize(os.path.join(icons_dir, 'icon-512.png'))}B")

# 同步到 assets(PWA 用),desktop-app/src/assets,desktop-app/src/assets,
# ios-app/www,public 目录
def sync_icons():
    for root_dir in [
        r"C:\Users\liuhua\Desktop\Github\markdown\android-app\app\src\main\assets\icons",
        r"C:\Users\liuhua\Desktop\Github\markdown\desktop-app\src\assets\icons",
        r"C:\Users\liuhua\Desktop\Github\markdown\ios-app\www\icons",
        r"C:\Users\liuhua\Desktop\Github\markdown\public\icons",
    ]:
        if not os.path.isdir(root_dir):
            continue
        for name, src in [("icon-192.png", os.path.join(icons_dir, "icon-192.png")),
                          ("icon-512.png", os.path.join(icons_dir, "icon-512.png"))]:
            dst = os.path.join(root_dir, name)
            try:
                with open(src, "rb") as fr, open(dst, "wb") as fw:
                    fw.write(fr.read())
                print(f"  sync {dst} ({os.path.getsize(dst)}B)")
            except Exception as e:
                print(f"  sync {dst} FAILED: {e}")


sync_icons()
