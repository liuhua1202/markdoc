"""生成 ic_launcher_foreground.xml (v1.0.11) —— 所有 pathData 用纯绝对命令。
   弧形和圆环改成 32 段折线近似,避免 m/a 等复杂命令。"""
import math
import os

VB = 1024
# 文档 + 折角 + M 字母(沿用 v1.0.10 缩放到 0.6 居中后的版本,纯绝对命令)
DOC_PATH = "M284,369 L586,369 L680,463 L680,736 Q680,786 630,786 L334,786 Q284,786 284,736 Z"
FOLD_PATH = "M586,369 L680,463 L586,463 Z"
M_PATH    = "M356,696 L356,512 L410,512 L482,597 L554,512 L608,512 L608,696 L566,696 L566,575 L500,649 L464,649 L398,575 L398,696 Z"

# 放大镜镜身(圆环,32 段折线) —— 缩小到半径 60,移到 (650,650) 完全在 M 右、文档内
def circle_polyline(cx, cy, r, segments=48):
    pts = []
    for i in range(segments + 1):
        a = 2 * math.pi * i / segments
        x = cx + r * math.cos(a)
        y = cy + r * math.sin(a)
        pts.append((x, y))
    d = f"M{pts[0][0]:.1f},{pts[0][1]:.1f}"
    for p in pts[1:]:
        d += f" L{p[0]:.1f},{p[1]:.1f}"
    d += " Z"
    return d

MAGNIFIER_RING = circle_polyline(650, 650, 60, segments=48)
MAGNIFIER_DOT  = circle_polyline(625, 625, 9,  segments=24)

# 把手: 一条线段 —— 调整到从镜身右下 60+42 角度开始,长度 50
HANDLE_PATH = "M692,692 L740,740"

xml = f'''<?xml version="1.0" encoding="utf-8"?>
<!-- 应用启动图标前景层 v1.0.11 (纯绝对命令,无 m/a) -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="1024"
    android:viewportHeight="1024">

    <!-- 文档卡片 (实心白) -->
    <path
        android:fillColor="#FFFFFF"
        android:pathData="{DOC_PATH}" />

    <!-- 折角三角 -->
    <path
        android:fillColor="#D8D8D8"
        android:pathData="{FOLD_PATH}" />

    <!-- 黑色 M 字母 (粗体,在文档内) -->
    <path
        android:fillColor="#000000"
        android:pathData="{M_PATH}" />

    <!-- 放大镜镜身外圈 (白描边圆) -->
    <path
        android:fillColor="#00000000"
        android:strokeColor="#FFFFFF"
        android:strokeWidth="36"
        android:pathData="{MAGNIFIER_RING}" />

    <!-- 放大镜把手 (白线) -->
    <path
        android:strokeColor="#FFFFFF"
        android:strokeWidth="48"
        android:strokeLineCap="round"
        android:pathData="{HANDLE_PATH}" />

    <!-- 镜身高光小点 (实心白圆) -->
    <path
        android:fillColor="#FFFFFF"
        android:pathData="{MAGNIFIER_DOT}" />

</vector>
'''

out = r"C:\Users\liuhua\Desktop\Github\markdown\android-app\app\src\main\res\drawable\ic_launcher_foreground.xml"
with open(out, "w", encoding="utf-8") as f:
    f.write(xml)
print("wrote", out, "size=", os.path.getsize(out))
print("---")
print(xml[:200] + "...")
