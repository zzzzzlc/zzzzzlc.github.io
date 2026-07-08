/** 场景背景色 */
export const SCENE_BACKGROUND = 0x1a1a2e;

/** 默认模型 / 加载模型材质颜色 */
export const MODEL_COLOR = 0x6c63ff;

/** 地板颜色 */
export const FLOOR_COLOR = 0x222244;

/** 网格主色 */
export const GRID_MAIN_COLOR = 0x444466;
/** 网格次色 */
export const GRID_SUB_COLOR = 0x333355;

/** 环境光强度 */
export const AMBIENT_LIGHT_INTENSITY = 0.6;
/** 主平行光强度 */
export const DIR_LIGHT_INTENSITY = 1.5;
/** 补光颜色 */
export const FILL_LIGHT_COLOR = 0x6688cc;
/** 补光强度 */
export const FILL_LIGHT_INTENSITY = 0.4;

/** 默认模型金属度（环面纽结） */
export const DEFAULT_MODEL_METALNESS = 0.3;
/** 默认模型粗糙度（环面纽结） */
export const DEFAULT_MODEL_ROUGHNESS = 0.4;
/** 加载模型默认材质金属度（STL/OBJ 兜底） */
export const LOADED_MODEL_METALNESS = 0.3;
/** 加载模型默认材质粗糙度（STL/OBJ 兜底） */
export const LOADED_MODEL_ROUGHNESS = 0.5;
/** 地板粗糙度 */
export const FLOOR_ROUGHNESS = 0.8;

/** 相机视场角（度） */
export const CAMERA_FOV = 50;
/** 相机近裁面 */
export const CAMERA_NEAR = 0.1;
/** 相机远裁面 */
export const CAMERA_FAR = 1000;
/** 相机初始位置 */
export const CAMERA_INITIAL_POSITION: readonly [number, number, number] = [3, 2, 5];
/** 控制器目标初始位置 */
export const CONTROLS_TARGET: readonly [number, number, number] = [0, 0, 0];

/** 阴影贴图尺寸 */
export const SHADOW_MAP_SIZE = 1024;

/** 渲染容器高度 */
export const VIEWER_HEIGHT = '75vh';

/** 上传接受的文件后缀 */
export const ACCEPTED_FORMATS = '.glb,.gltf,.obj,.stl';
