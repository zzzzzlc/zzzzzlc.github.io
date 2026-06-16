---
title: 标准三视图草图生成 3D 建模：从工程图纸到参数化模型
date: '2026-06-13'
tags:
  - 3D
  - 计算机视觉
  - 工程化
  - CAD
category: 工程实践
summary: >-
  从"标准工程草图手动建模效率低"的痛点出发，聚焦标准三视图草图（正/侧/俯+尺寸标注）自动生成 3D 模型的完整工程方案——草图预处理与向量化、尺寸标注识别、轮廓提取与拓扑重建、CSG
  建模策略（拉伸/旋转/布尔运算）、参数化 CAD 输出、前端 3D 预览集成，以及多方案对比与局限性分析。
---

# 标准三视图草图生成 3D 建模：从工程图纸到参数化模型

## 一、问题来源

**标准三视图草图**是工程领域最通用的设计表达方式——正视图、侧视图、俯视图配合尺寸标注，完整定义了一个零件的几何形状。但从草图到 3D 模型的过程仍然高度手动：

**业务痛点：**

- 机械设计师画完三视图后，还要在 SolidWorks / UG / Creo 中**逐特征重建 3D 模型**，重复工作量占设计流程的 40%-60%
- 供应商来料的三视图图纸需要人工录入 ERP/MES 系统，手工建模既慢又易错
- 旧图纸数字化时，大量纸质蓝图的三视图需要转为 3D 模型，纯人工处理不现实
- 教学场景中，学生画完三视图无法快速验证空间想象力是否正确

**技术痛点：**

- 工程草图不同于渲染图/照片，是**线条+标注**的矢量表达，现有 AI 图生 3D 方案（InstantMesh、TripoSR）不适用
- 草图中包含尺寸标注线、箭头、数字、中心线、虚线等多种图元，**识别和分类是首要难题**
- 三视图之间需要精确对齐（正视图的宽 = 俯视图的宽，正视图的高 = 侧视图的高）
- 工程形体通常由 CSG（Constructive Solid Geometry）基本体组合，需要识别出拉伸体、旋转体、孔洞等特征

**核心问题：标准三视图草图→3D 建模，不是简单的"图片生成模型"，而是工程图理解+几何推理+参数化重建的综合任务。本文将聚焦这一场景，给出从草图解析到 3D 输出的完整工程方案。**

---

## 二、标准三视图草图的结构

### 2.1 三视图的投影关系

```
标准三视图投影关系（第一角投影法）：

               ┌─────────────┐
               │   俯视图     │
               │  (X-Y 平面)  │        俯视图在正视图上方
               │  width=x    │        俯视图宽度 = 正视图宽度
               └──────┬──────┘
               "长对正"│
               ┌──────┴──────┐        ┌─────────────┐
               │   正视图     │        │   侧视图     │
               │  (X-Z 平面)  │        │  (Y-Z 平面)  │
               │  width=x    │        │  height=z    │
               │  height=z   │        │  depth=y     │
               └─────────────┘        └─────────────┘
                      "高平齐"               "宽相等"

  投影规则：
    长对正：正视图和俯视图的 X 轴（宽度）对齐
    高平齐：正视图和侧视图的 Z 轴（高度）对齐
    宽相等：俯视图的 X 轴 = 侧视图的 Y 轴（深度）
```

### 2.2 草图中的图元类型

| 图元类型 | 视觉特征 | 几何含义 | 识别难度 |
|---------|---------|---------|---------|
| **粗实线** | 粗黑线 | 可见轮廓线 | ★ |
| **虚线** | 短划线 | 不可见轮廓线（隐藏边） | ★★ |
| **点划线** | 长短交替划线 | 中心线/对称轴 | ★★ |
| **尺寸线** | 细实线+箭头+数字 | 标注尺寸值 | ★★★ |
| **剖面线** | 斜平行线组 | 剖切面填充 | ★★ |
| **标注文字** | 数字/字母 | 尺寸值、公差、注释 | ★★★ |
| **圆/圆弧** | 曲线 | 孔洞、倒角、圆角 | ★★ |
| **角度标注** | 弧线+数字 | 倾斜角度 | ★★★ |

### 2.3 输入输出定义

```
输入：标准三视图草图（扫描件 / 手绘拍照 / CAD 导出 2D 图）
  ├── 正视图（Front View）: X-Z 平面轮廓
  ├── 侧视图（Side View） : Y-Z 平面轮廓（左侧视或右侧视）
  ├── 俯视图（Top View）  : X-Y 平面轮廓
  └── 可选：尺寸标注、剖面图、局部放大图

输出：3D 模型
  ├── STEP / IGES（参数化 CAD 格式，推荐）
  ├── STL / OBJ（网格格式）
  └── FreeCAD (.FCStd) / Blender (.blend)（原生工程文件）
```

---

## 三、技术方案架构

### 3.1 完整 Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                  标准三视图草图 → 3D 模型 Pipeline            │
└─────────────────────────────────────────────────────────────┘

  三视图草图图片
       │
  ┌────▼───────────────────────────────────────────────────┐
  │ 第一步：预处理与图元分离                                   │
  │   ├── 灰度化 + 自适应二值化                                │
  │   ├── 图元分类（粗实线/虚线/点划线/尺寸线/文字）              │
  │   ├── 去噪 + 断线连接                                      │
  │   └── 三个视图区域分割（自动/手动）                          │
  └────┬───────────────────────────────────────────────────┘
       │
  ┌────▼───────────────────────────────────────────────────┐
  │ 第二步：轮廓提取与向量化                                    │
  │   ├── 外轮廓提取（findContours → 最外层轮廓）               │
  │   ├── 内轮廓提取（孔洞/凹槽）                               │
  │   ├── 轮廓向量化（Douglas-Peucker 折线逼近）                │
  │   ├── 圆弧拟合（最小二乘拟合圆/椭圆）                       │
  │   └── 拓扑关系构建（邻接、包含、相切）                       │
  └────┬───────────────────────────────────────────────────┘
       │
  ┌────▼───────────────────────────────────────────────────┐
  │ 第三步：尺寸标注识别                                       │
  │   ├── 尺寸线检测（箭头+引线定位）                           │
  │   ├── 数字 OCR（PaddleOCR / Tesseract）                   │
  │   ├── 尺寸关联（将数值绑定到对应轮廓段）                     │
  │   └── 单位推断（默认 mm，通过公差符号判断）                  │
  └────┬───────────────────────────────────────────────────┘
       │
  ┌────▼───────────────────────────────────────────────────┐
  │ 第四步：坐标系对齐                                         │
  │   ├── 正视图轮廓对齐 X-Z 平面                              │
  │   ├── 侧视图轮廓对齐 Y-Z 平面                              │
  │   ├── 俯视图轮廓对齐 X-Y 平面                              │
  │   └── 尺寸校准（像素坐标 → 物理尺寸）                       │
  └────┬───────────────────────────────────────────────────┘
       │
  ┌────▼───────────────────────────────────────────────────┐
  │ 第五步：特征识别与 CSG 建模                                │
  │   ├── 基础体识别（长方体/圆柱/圆锥/棱柱）                   │
  │   ├── 操作序列推断（拉伸/旋转/扫掠/布尔并/差/交）            │
  │   ├── 孔洞识别（同心圆 → 通孔/盲孔）                        │
  │   ├── 倒角/圆角识别                                       │
  │   └── 构建操作树（CSG Tree）                              │
  └────┬───────────────────────────────────────────────────┘
       │
  ┌────▼───────────────────────────────────────────────────┐
  │ 第六步：3D 重建与输出                                      │
  │   ├── 执行 CSG 操作序列 → 生成 B-Rep 模型                  │
  │   ├── 网格化（可选：STL/OBJ 导出）                          │
  │   ├── 参数化输出（STEP/IGES）                              │
  │   └── Three.js 前端预览                                   │
  └────────────────────────────────────────────────────────┘
```

---

## 四、草图预处理与图元分离

### 4.1 图元分类策略

工程草图中的线条类型不同，几何含义也不同。分类是第一步关键工作：

```python
import cv2
import numpy as np

def classify_line_types(image_path: str) -> dict:
    """将草图中的不同线型分类"""
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)

    # 二值化
    _, binary = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # 线宽分析：粗实线 vs 细实线（尺寸线）
    kernel_thick = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    kernel_thin = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))

    # 粗线（轮廓线）：膨胀后与细线膨胀的差异
    thick = cv2.dilate(binary, kernel_thick)
    thin = cv2.dilate(binary, kernel_thin)
    contour_lines = cv2.erode(thick & ~cv2.dilate(thin, kernel_thick), kernel_thin)

    # 虚线检测：断续线段
    # 先提取所有水平/垂直短线段，统计间隔模式
    horizontal = cv2.morphologyEx(binary, cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (15, 1)))
    dashed = horizontal & ~contour_lines

    # 点划线检测：长短交替
    long_line = cv2.morphologyEx(binary, cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (30, 1)))
    center_line = long_line & ~contour_lines & ~dashed

    return {
        "contour": contour_lines,    # 粗实线 → 轮廓
        "hidden": dashed,            # 虚线 → 隐藏边
        "center": center_line,       # 点划线 → 中心线
        "original": binary,          # 原始二值图
    }
```

### 4.2 尺寸标注区域分离

```python
def separate_dimension_area(binary: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """分离尺寸标注区域和几何轮廓区域"""
    # 文字区域特征：密集的小连通域
    # 用连通域分析找出面积小且宽高比特殊的区域
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(binary)

    text_mask = np.zeros_like(binary)
    drawing_mask = np.zeros_like(binary)

    for i in range(1, num_labels):
        x, y, w, h, area = stats[i]
        aspect_ratio = w / max(h, 1)

        if area < 500 and 0.2 < aspect_ratio < 5:
            # 小面积 → 可能是文字/数字
            text_mask[labels == i] = 255
        elif area >= 500:
            # 大面积 → 几何轮廓
            drawing_mask[labels == i] = 255

    return drawing_mask, text_mask
```

---

## 五、轮廓提取与向量化

### 5.1 轮廓提取

```python
from dataclasses import dataclass

@dataclass
class Contour:
    """向量化轮廓"""
    points: list[tuple[float, float]]   # 折线顶点
    arcs: list[dict]                     # 圆弧段 {center, radius, start_angle, end_angle}
    is_outer: bool                       # 外轮廓/内轮廓（孔洞）
    contour_type: str                    # "solid" / "hidden"

def extract_contours(drawing_mask: np.ndarray) -> list[Contour]:
    """提取并矢量化轮廓"""
    contours_data = cv2.findContours(
        drawing_mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE
    )
    hierarchy = contours_data[1] if len(contours_data) == 3 else contours_data[1]
    raw_contours = contours_data[0] if len(contours_data) == 3 else contours_data[0]

    results = []
    for i, cnt in enumerate(raw_contours):
        if len(cnt) < 3:
            continue

        # Douglas-Peucker 折线逼近
        epsilon = 0.01 * cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, epsilon, True)

        # 圆弧拟合：检查哪些段可以用圆弧替代
        points = [(p[0][0], p[0][1]) for p in approx]
        arcs = fit_arcs(points, cnt)

        # 判断外轮廓/内轮廓（通过 hierarchy）
        is_outer = hierarchy[0][i][3] == -1  # 无父轮廓 → 外轮廓

        results.append(Contour(
            points=points,
            arcs=arcs,
            is_outer=is_outer,
            contour_type="solid",
        ))

    return results

def fit_arcs(polyline_points: list, raw_contour: np.ndarray) -> list[dict]:
    """检测折线中的圆弧段"""
    arcs = []
    # 对每 3 个相邻顶点，检查中间的原始轮廓点是否近似圆弧
    for i in range(1, len(polyline_points) - 1):
        p1 = polyline_points[i - 1]
        p2 = polyline_points[i]
        p3 = polyline_points[i + 1]

        # 提取该段的原始轮廓点
        segment = extract_segment_points(raw_contour, p1, p3)

        # 最小二乘拟合圆
        circle = fit_circle_least_squares(segment)
        if circle and circle["residual"] < 2.0:  # 残差阈值
            arcs.append({
                "center": circle["center"],
                "radius": circle["radius"],
                "start": p1,
                "end": p3,
            })

    return arcs

def fit_circle_least_squares(points: np.ndarray) -> dict | None:
    """最小二乘法拟合圆"""
    if len(points) < 5:
        return None

    x = points[:, 0].astype(float)
    y = points[:, 1].astype(float)

    # 圆方程: (x-a)^2 + (y-b)^2 = r^2
    # 展开: x^2 + y^2 - 2ax - 2by + (a^2 + b^2 - r^2) = 0
    A = np.column_stack([-2 * x, -2 * y, np.ones(len(x))])
    b = -(x ** 2 + y ** 2)

    try:
        result, residuals, _, _ = np.linalg.lstsq(A, b, rcond=None)
        cx, cy = result[0], result[1]
        r = np.sqrt(cx ** 2 + cy ** 2 - result[2])
        avg_residual = np.mean(np.abs(residuals)) if len(residuals) > 0 else 0
        return {"center": (cx, cy), "radius": r, "residual": avg_residual}
    except np.linalg.LinAlgError:
        return None
```

### 5.2 三视图坐标系对齐

```python
@dataclass
class AlignedViews:
    """对齐后的三视图数据"""
    front: list[Contour]  # 正视图（X-Z 平面）
    side: list[Contour]   # 侧视图（Y-Z 平面）
    top: list[Contour]    # 俯视图（X-Y 平面）
    scale: float          # 像素 → mm 比例尺
    origin: tuple[float, float]  # 原点在正视图中的像素坐标

def align_views(
    front_contours: list[Contour],
    side_contours: list[Contour],
    top_contours: list[Contour],
    dimensions: list[dict],  # 尺寸标注
) -> AlignedViews:
    """三视图坐标对齐"""
    # 1. 找到正视图的包围盒作为参考
    front_bbox = get_bounding_box(front_contours)
    front_w = front_bbox["width"]   # 像素宽度
    front_h = front_bbox["height"]  # 像素高度

    # 2. 通过尺寸标注计算比例尺
    #    找到正视图水平方向的尺寸标注
    dim_x = find_dimension_for_axis(dimensions, "x")
    dim_z = find_dimension_for_axis(dimensions, "z")
    scale = dim_x / front_w if front_w > 0 else 1.0

    # 3. 对齐侧视图（高平齐：Z 轴与正视图对齐）
    side_bbox = get_bounding_box(side_contours)
    side_contours = scale_contours(side_contours, scale)
    side_contours = translate_contours(
        side_contours,
        dx=0,
        dy=front_bbox["top"] - side_bbox["top"] * scale  # Z 轴对齐
    )

    # 4. 对齐俯视图（长对正：X 轴与正视图对齐）
    top_bbox = get_bounding_box(top_contours)
    top_contours = scale_contours(top_contours, scale)
    top_contours = translate_contours(
        top_contours,
        dx=front_bbox["left"] - top_bbox["left"] * scale,  # X 轴对齐
        dy=0,
    )

    return AlignedViews(
        front=front_contours,
        side=side_contours,
        top=top_contours,
        scale=scale,
        origin=(front_bbox["left"], front_bbox["bottom"]),
    )
```

---

## 六、尺寸标注识别

### 6.1 尺寸线检测

```python
import pytesseract
from PIL import Image

def detect_dimension_lines(text_mask: np.ndarray) -> list[dict]:
    """检测尺寸标注线和数值"""
    # 1. 检测箭头（箭头形状模板匹配）
    arrow_template = create_arrow_templates()
    arrows = template_match_multi(text_mask, arrow_template)

    # 2. 检测数字区域（OCR）
    ocr_results = pytesseract.image_to_data(
        Image.fromarray(text_mask),
        config='--psm 7 -c tessedit_char_whitelist=0123456789.+-°R',
        output_type=pytesseract.Output.DICT,
    )

    # 3. 关联箭头对 → 尺寸线
    dimensions = []
    for i in range(0, len(arrows) - 1, 2):
        a1, a2 = arrows[i], arrows[i + 1]
        # 在两箭头之间找最近的数字
        value = find_nearest_number(ocr_results, a1, a2)
        axis = infer_axis(a1, a2)  # 水平→X, 垂直→Z, 斜线→角度

        dimensions.append({
            "value": value,
            "axis": axis,
            "start": a1["tip"],
            "end": a2["tip"],
            "pixel_length": distance(a1["tip"], a2["tip"]),
        })

    return dimensions

def infer_axis(p1: tuple, p2: tuple) -> str:
    """推断尺寸线对应的轴向"""
    dx = abs(p2[0] - p1[0])
    dy = abs(p2[1] - p1[1])

    if dx > dy * 3:
        return "x"    # 水平 → X 轴（宽度）
    elif dy > dx * 3:
        return "z"    # 垂直 → Z 轴（高度）
    else:
        return "angle"  # 斜线 → 角度标注
```

### 6.2 尺寸值绑定

```python
def bind_dimensions_to_contours(
    contours: list[Contour],
    dimensions: list[dict],
    scale: float,
) -> list[Contour]:
    """将尺寸数值绑定到对应轮廓段"""
    for dim in dimensions:
        real_value = dim["value"]  # mm
        pixel_value = dim["pixel_length"]

        for contour in contours:
            for i, (p1, p2) in enumerate(zip(contour.points, contour.points[1:])):
                # 检查尺寸线是否对应这段轮廓边
                seg_pixel_len = distance(p1, p2)
                seg_real_len = seg_pixel_len * scale

                # 匹配条件：方向一致 + 长度接近
                seg_axis = infer_axis(p1, p2)
                if seg_axis == dim["axis"] and abs(seg_real_len - real_value) < 2.0:
                    # 将轮廓段的像素坐标替换为真实尺寸
                    contour.points[i] = p1
                    contour.points[i + 1] = adjust_to_real_size(
                        p1, p2, real_value, dim["axis"]
                    )

    return contours
```

---

## 七、特征识别与 CSG 建模

### 7.1 CSG（Constructive Solid Geometry）基础

CSG 是用基本体通过布尔运算组合出复杂形体的方法：

```
CSG 操作树（示例：带孔的 L 形支架）：

  Union（并集）
    ├── Extrude（拉伸体 A → L 形底板）
    │     └── 正视图 L 形轮廓，深度=50mm
    ├── Extrude（拉伸体 B → 竖板）
    │     └── 正视图矩形轮廓，深度=30mm
    └── Difference（差集）
          ├── 参考：拉伸体 A
          └── Cylinder（圆柱 → 通孔 × 2）
                ├── 孔 1: center=(20, 30), r=5, depth=50
                └── 孔 2: center=(80, 30), r=5, depth=50

  输出：L 形支架，带两个通孔
```

### 7.2 基础体识别

```python
from enum import Enum
from dataclasses import dataclass

class FeatureType(Enum):
    BOX = "box"               # 长方体（矩形拉伸）
    CYLINDER = "cylinder"     # 圆柱体
    CONE = "cone"             # 圆锥体
    PRISM = "prism"           # 棱柱体（多边形拉伸）
    REVOLUTION = "revolution" # 旋转体（含圆弧的轮廓绕轴旋转）
    HOLE_THROUGH = "hole_through"   # 通孔
    HOLE_BLIND = "hole_blind"       # 盲孔
    FILLET = "fillet"         # 圆角
    CHAMFER = "chamfer"       # 倒角

@dataclass
class Feature:
    """识别出的特征"""
    type: FeatureType
    params: dict              # 特征参数
    operation: str            # "add" / "subtract"（布尔并/差）

def identify_features(
    front: list[Contour],
    side: list[Contour],
    top: list[Contour],
) -> list[Feature]:
    """从三视图轮廓中识别特征"""
    features = []

    # === 1. 识别外轮廓特征 ===
    front_outer = [c for c in front if c.is_outer][0]
    front_inner = [c for c in front if not c.is_outer]

    # 检查正视图外轮廓是否为矩形 → 长方体
    if is_rectangle(front_outer.points):
        bbox = get_bbox(front_outer.points)
        side_outer = [c for c in side if c.is_outer][0]
        depth = get_bbox(side_outer.points)["width"]
        features.append(Feature(
            type=FeatureType.BOX,
            params={
                "width": bbox["width"],
                "height": bbox["height"],
                "depth": depth,
            },
            operation="add",
        ))

    # 检查是否含圆弧 → 可能是旋转体或圆柱
    elif len(front_outer.arcs) > 0:
        for arc in front_outer.arcs:
            if is_full_circle(arc, front_outer):
                # 正视图中有完整圆 → 圆柱体
                features.append(Feature(
                    type=FeatureType.CYLINDER,
                    params={
                        "radius": arc["radius"],
                        "height": get_depth_from_side(side),
                    },
                    operation="add",
                ))
            elif arc.get("is_revolution_profile"):
                # 圆弧是旋转体轮廓的一部分
                features.append(Feature(
                    type=FeatureType.REVOLUTION,
                    params={
                        "profile": front_outer.points,
                        "axis": find_center_line(front),
                    },
                    operation="add",
                ))

    # 检查是否为多边形 → 棱柱
    elif len(front_outer.points) >= 4 and not is_rectangle(front_outer.points):
        features.append(Feature(
            type=FeatureType.PRISM,
            params={
                "profile": front_outer.points,
                "depth": get_depth_from_side(side),
            },
            operation="add",
        ))

    # === 2. 识别内轮廓（孔洞）===
    for inner in front_inner:
        # 正视图中的内轮廓
        if is_circle(inner):
            # 圆形内轮廓 → 孔
            circle = fit_circle(inner.points)
            is_through = check_through_hole(inner, top)  # 俯视图也有对应圆 → 通孔
            features.append(Feature(
                type=FeatureType.HOLE_THROUGH if is_through else FeatureType.HOLE_BLIND,
                params={
                    "center": circle["center"],
                    "radius": circle["radius"],
                    "depth": get_depth_from_side(side) if is_through else None,
                },
                operation="subtract",
            ))
        elif is_rectangle(inner):
            # 矩形内轮廓 → 矩形凹槽
            bbox = get_bbox(inner.points)
            features.append(Feature(
                type=FeatureType.BOX,
                params={
                    "width": bbox["width"],
                    "height": bbox["height"],
                    "depth": get_depth_from_side(side),
                },
                operation="subtract",
            ))

    # === 3. 识别圆角/倒角 ===
    for arc in front_outer.arcs:
        if arc["radius"] < 5:  # 小半径圆弧 → 圆角
            features.append(Feature(
                type=FeatureType.FILLET,
                params={
                    "edge": find_adjacent_edges(arc, front_outer),
                    "radius": arc["radius"],
                },
                operation="add",
            ))

    return features
```

### 7.3 CSG 操作执行（FreeCAD）

```python
import FreeCAD
import Part

def execute_csg(features: list[Feature], doc_name: str = "AutoPart") -> Part.Shape:
    """执行 CSG 操作序列，生成 3D 模型"""
    doc = FreeCAD.newDocument(doc_name)
    result = None

    for feature in features:
        shape = create_primitive(feature)

        if result is None:
            result = shape
        elif feature.operation == "add":
            result = result.fuse(shape)     # 布尔并
        elif feature.operation == "subtract":
            result = result.cut(shape)      # 布尔差

    # 添加到文档
    Part.show(result, "AutoPart")
    doc.recompute()

    # 导出 STEP
    import Import
    Import.export([doc.getObject("AutoPart")], f"{doc_name}.step")

    # 导出 STL
    Mesh.export([doc.getObject("AutoPart")], f"{doc_name}.stl")

    return result

def create_primitive(feature: Feature) -> Part.Shape:
    """根据特征类型创建基本体"""
    p = feature.params

    if feature.type == FeatureType.BOX:
        return Part.makeBox(
            p["width"], p["depth"], p["height"],
            FreeCAD.Vector(0, 0, 0),
        )

    elif feature.type == FeatureType.CYLINDER:
        return Part.makeCylinder(
            p["radius"], p["height"],
            FreeCAD.Vector(*p.get("center", (0, 0, 0))),
            FreeCAD.Vector(0, 0, 1),
        )

    elif feature.type == FeatureType.PRISM:
        # 多边形拉伸
        wire = make_wire_from_points(p["profile"])
        face = Part.Face(wire)
        return face.extrude(FreeCAD.Vector(0, 0, p["depth"]))

    elif feature.type == FeatureType.REVOLUTION:
        # 旋转体
        wire = make_wire_from_points(p["profile"])
        face = Part.Face(wire)
        axis = FreeCAD.Vector(*p["axis"])
        return face.revolve(axis, 360)

    elif feature.type in (FeatureType.HOLE_THROUGH, FeatureType.HOLE_BLIND):
        depth = p.get("depth", 1000)  # 通孔用大值穿透
        return Part.makeCylinder(
            p["radius"], depth,
            FreeCAD.Vector(*p["center"]),
            FreeCAD.Vector(0, 1, 0),  # 沿 Y 轴穿透
        )

    elif feature.type == FeatureType.FILLET:
        # 圆角需要先获取对应边再倒角
        # 这里简化处理
        return Part.Shape()

    return Part.Shape()
```

---

## 八、体素交叉验证法（辅助方案）

### 8.1 原理

当特征识别无法覆盖复杂形体时，用体素交叉法作为兜底：

```python
def voxel_cross_intersection(
    front_mask: np.ndarray,
    side_mask: np.ndarray,
    top_mask: np.ndarray,
    resolution: int = 256,
) -> np.ndarray:
    """三视图体素交叉法重建"""

    # 正视图轮廓沿 Y 拉伸
    voxel_f = np.zeros((resolution, resolution, resolution), dtype=np.uint8)
    for x in range(resolution):
        for z in range(resolution):
            if front_mask[z, x]:
                voxel_f[x, :, z] = 1  # 沿 Y 轴全部填充

    # 侧视图轮廓沿 X 拉伸
    voxel_s = np.zeros((resolution, resolution, resolution), dtype=np.uint8)
    for y in range(resolution):
        for z in range(resolution):
            if side_mask[z, y]:
                voxel_s[:, y, z] = 1  # 沿 X 轴全部填充

    # 俯视图轮廓沿 Z 拉伸
    voxel_t = np.zeros((resolution, resolution, resolution), dtype=np.uint8)
    for x in range(resolution):
        for y in range(resolution):
            if top_mask[y, x]:
                voxel_t[x, y, :] = 1  # 沿 Z 轴全部填充

    # 向量化版本（更快）
    # voxel_f = np.tile(front_mask[:, :, np.newaxis], (1, 1, resolution)).transpose(1, 2, 0)
    # voxel_s = np.tile(side_mask[np.newaxis, :, :], (resolution, 1, 1)).transpose(2, 1, 0)
    # voxel_t = np.tile(top_mask[:, np.newaxis, :], (1, resolution, 1)).transpose(0, 1, 2)

    # 三者取交集
    volume = voxel_f & voxel_s & voxel_t

    # 添加虚线区域的体素（隐藏结构）
    # 虚线表示被遮挡的内部结构，需要在对应位置额外添加体素
    hidden_volume = add_hidden_structures(volume, front_hidden, side_hidden, top_hidden)
    volume = volume | hidden_volume

    return volume
```

### 8.2 体素→网格→CAD

```python
from skimage import measure
import trimesh

def voxel_to_cad(volume: np.ndarray, scale: float = 1.0) -> trimesh.Trimesh:
    """体素 → 网格 → 简化 → 平滑"""
    # Marching Cubes 提取等值面
    verts, faces, normals, _ = measure.marching_cubes(
        volume, level=0.5, spacing=(scale,) * 3
    )

    mesh = trimesh.Trimesh(vertices=verts, faces=faces, vertex_normals=normals)

    # 网格平滑
    mesh = trimesh.smoothing.filter_laplacian(mesh, iterations=3)

    # 网格简化
    mesh = mesh.simplify_quadric_decimation(face_count=5000)

    # 修复
    mesh.fill_holes()
    mesh.fix_normals()

    return mesh
```

---

## 九、完整工程集成

### 9.1 后端服务

```python
# server.py — FastAPI 完整服务
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import tempfile, subprocess, json

app = FastAPI(title="三视图草图→3D 建模服务")

class GenerateRequest(BaseModel):
    method: str = "csg"       # "csg" / "voxel"
    resolution: int = 256     # 体素分辨率（仅 voxel 模式）
    output_format: str = "step"  # "step" / "stl" / "obj"

@app.post("/api/sketch-to-3d")
async def sketch_to_3d(
    front: UploadFile = File(...),
    side: UploadFile = File(...),
    top: UploadFile = File(...),
    method: str = "csg",
    output_format: str = "step",
):
    """三视图草图 → 3D 模型"""
    with tempfile.TemporaryDirectory() as tmpdir:
        # 保存上传文件
        front_path = f"{tmpdir}/front.png"
        side_path = f"{tmpdir}/side.png"
        top_path = f"{tmpdir}/top.png"

        with open(front_path, "wb") as f: f.write(await front.read())
        with open(side_path, "wb") as f: f.write(await side.read())
        with open(top_path, "wb") as f: f.write(await top.read())

        # === Pipeline 执行 ===
        # 1. 预处理
        front_mask, front_hidden = preprocess(front_path)
        side_mask, side_hidden = preprocess(side_path)
        top_mask, top_hidden = preprocess(top_path)

        # 2. 轮廓提取
        front_contours = extract_contours(front_mask)
        side_contours = extract_contours(side_mask)
        top_contours = extract_contours(top_mask)

        # 3. 尺寸识别
        dims_front = detect_dimension_lines(front_path)
        dims_side = detect_dimension_lines(side_path)
        dims_top = detect_dimension_lines(top_path)

        # 4. 对齐
        aligned = align_views(front_contours, side_contours, top_contours,
                              dims_front + dims_side + dims_top)

        if method == "csg":
            # 5a. CSG 建模
            features = identify_features(aligned.front, aligned.side, aligned.top)
            # 调用 FreeCAD 执行 CSG
            output_path = f"{tmpdir}/output.{output_format}"
            subprocess.run([
                "FreeCADCmd", "--headless",
                "-c",
                f"exec_csg_from_features('{json.dumps(serialize_features(features))}', '{output_path}')"
            ], check=True)

        else:
            # 5b. 体素重建
            volume = voxel_cross_intersection(front_mask, side_mask, top_mask)
            mesh = voxel_to_cad(volume, aligned.scale)
            output_path = f"{tmpdir}/output.{output_format}"
            mesh.export(output_path)

        return FileResponse(
            output_path,
            media_type=get_media_type(output_format),
            filename=f"model.{output_format}",
        )

def get_media_type(fmt: str) -> str:
    return {"step": "application/step", "stl": "model/stl", "obj": "text/plain"}[fmt]
```

### 9.2 前端组件（React + Three.js）

```tsx
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Upload, Button, Card, Space, Select, message, Spin } from 'antd';
import { BoxOutlined, ExperimentOutlined } from '@ant-design/icons';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

interface ViewFile { label: string; file: File | null }

export default function SketchTo3DViewer() {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const [views, setViews] = useState<ViewFile[]>([
        { label: '正视图', file: null },
        { label: '侧视图', file: null },
        { label: '俯视图', file: null },
    ]);
    const [method, setMethod] = useState<'csg' | 'voxel'>('csg');
    const [loading, setLoading] = useState(false);

    const initScene = useCallback(() => {
        if (!containerRef.current) return;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a2e);

        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);
        camera.position.set(200, 150, 200);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(containerRef.current.clientWidth, 500);
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;

        // 灯光
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(100, 200, 100);
        scene.add(dirLight);

        // 网格辅助
        const grid = new THREE.GridHelper(200, 20, 0x444466, 0x222244);
        scene.add(grid);

        sceneRef.current = scene;

        const animate = () => {
            requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();
    }, []);

    useEffect(() => { initScene(); }, [initScene]);

    const handleGenerate = async () => {
        const hasAllViews = views.every(v => v.file !== null);
        if (!hasAllViews) { message.warning('请上传三张三视图'); return; }

        setLoading(true);
        const formData = new FormData();
        formData.append('front', views[0].file!);
        formData.append('side', views[1].file!);
        formData.append('top', views[2].file!);

        try {
            const res = await fetch(`/api/sketch-to-3d?method=${method}&output_format=stl`, {
                method: 'POST', body: formData,
            });
            if (!res.ok) throw new Error('生成失败');

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);

            // 加载 STL
            const loader = new STLLoader();
            loader.load(url, (geometry) => {
                geometry.computeVertexNormals();
                const material = new THREE.MeshStandardMaterial({
                    color: 0x6c63ff, metalness: 0.3, roughness: 0.4,
                });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;

                // 清除旧模型
                sceneRef.current?.children
                    .filter(c => c instanceof THREE.Mesh)
                    .forEach(c => sceneRef.current!.remove(c));

                sceneRef.current?.add(mesh);
                message.success('3D 模型生成完成');
            });
        } catch (e) {
            message.error('生成失败：' + (e as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: 24 }}>
            <Card title="标准三视图草图 → 3D 建模">
                <Space direction="vertical" style={{ width: '100%' }}>
                    {views.map((v, i) => (
                        <Upload
                            key={i}
                            accept="image/*"
                            maxCount={1}
                            beforeUpload={(file) => {
                                const newViews = [...views];
                                newViews[i] = { ...newViews[i], file };
                                setViews(newViews);
                                return false;
                            }}
                        >
                            <Button icon={<BoxOutlined />}>上传{v.label}</Button>
                        </Upload>
                    ))}

                    <Select value={method} onChange={setMethod} style={{ width: 200 }}>
                        <Select.Option value="csg">CSG 参数化建模</Select.Option>
                        <Select.Option value="voxel">体素交叉重建</Select.Option>
                    </Select>

                    <Button
                        type="primary"
                        icon={<ExperimentOutlined />}
                        loading={loading}
                        onClick={handleGenerate}
                    >
                        生成 3D 模型
                    </Button>
                </Space>
            </Card>

            <Card title="3D 预览" style={{ marginTop: 16 }}>
                <div ref={containerRef} style={{ width: '100%', minHeight: 500 }} />
            </Card>
        </div>
    );
}
```

---

## 十、方案对比

### 10.1 CSG vs 体素交叉法

| 维度 | CSG 参数化建模 | 体素交叉法 |
|------|--------------|-----------|
| **输出精度** | ★★★★★（精确尺寸） | ★★★（受分辨率限制） |
| **输出格式** | STEP/IGES（CAD 格式） | STL/OBJ（网格格式） |
| **可编辑性** | ★★★★★（参数化，可修改） | ★★（网格不可参数化编辑） |
| **处理速度** | 快（<5s） | 中（5-30s，取决于分辨率） |
| **复杂形体** | ★★★（需要正确识别特征） | ★★★★（任何形体都能近似） |
| **圆弧/曲面** | ★★★★★（精确圆弧/旋转体） | ★★★（体素化近似） |
| **虚线处理** | ★★（需额外逻辑） | ★★★★（可直接加入体素） |
| **适用场景** | 机械零件、工业设计 | 形态验证、快速预览 |

### 10.2 推荐策略

```
选择哪种方案？

  草图是否为规则工程图（直线+圆弧+尺寸标注）？
    │
    ├── 是 → CSG 参数化建模（优先）
    │         └── 输出 STEP，可直接用于 CNC/3D打印
    │
    └── 否 / 形体复杂 → 体素交叉法（兜底）
                          └── 输出 STL，用于预览验证
```

---

## 十一、优缺点与适用场景总结

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| **CSG 参数化建模** | 精度最高、输出 STEP 可加工、参数可修改 | 特征识别依赖规则、复杂形体识别率低 | 机械零件、钣金、标准件 |
| **体素交叉法** | 算法简单、不依赖特征识别、任何形体都能近似 | 精度受限于分辨率、输出网格不可参数化编辑 | 形态验证、教学演示、快速预览 |
| **CSG + 体素混合** | CSG 处理主体、体素处理复杂局部 | 工程复杂度高 | 生产级应用 |
| **Blender 脚本辅助** | 人工可介入修正、可视化好 | 需安装 Blender、非全自动 | 设计师工作流 |
| **FreeCAD 批处理** | 无需 GUI、命令行批量处理、输出 STEP | FreeCAD API 学习成本 | 批量旧图纸数字化 |

---

## 十二、局限性

1. **尺寸标注识别率有限**：手写数字、倾斜标注、重叠标注的 OCR 识别率不稳定，需要人工校验
2. **复杂特征识别率低**：多台阶、螺纹、齿轮齿形等复杂特征的自动识别仍然困难
3. **虚线→内部结构推断难**：虚线表示被遮挡的边，但无法确定内部结构的完整 3D 形状（可能有多种解释）
4. **非标准投影**：斜视图、局部视图、剖视图的自动处理仍需人工干预
5. **公差与配合**：草图中的公差标注（H7/g6 等）无法直接反映到 3D 模型
6. **表面粗糙度/加工符号**：工程图中的表面质量标注无法自动映射到 3D
7. **第一角/第三角投影**：不同国家采用不同投影法（中国/欧洲用第一角，美国用第三角），需要自动识别或手动指定
8. **草图质量影响大**：手绘草图的线条质量（粗细不均、断线、污渍）严重影响预处理效果

---

## 十三、总结

标准三视图草图生成 3D 建模的核心路径是**草图理解 → 特征识别 → CSG 重建**：

- **草图预处理**是基础：线型分类、轮廓提取、向量化质量直接决定后续步骤的准确性
- **CSG 建模**是核心：将三视图轮廓转换为拉伸/旋转/布尔运算的操作序列，输出参数化 STEP 格式
- **体素交叉法**是兜底：当特征识别无法覆盖时，用体素交集近似重建
- **尺寸标注识别**是加分项：有尺寸标注时精度大幅提升，没有时退化为像素比例估算
- **混合方案最优**：CSG 为主（精确）+ 体素辅助（兜底）+ 人工校验（关键尺寸），才是可落地的工程方案
- **前端 3D 预览**：Three.js + STL/GLB 加载，为用户提供即时反馈，降低返工率
