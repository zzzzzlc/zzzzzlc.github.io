/**
 * ParticleField 常量：粒子数 / 球面半径 / 角色采样 / 形态切换时长。
 * 集中管理，便于在不读引擎实现的前提下调参。
 */

/** 粒子总数：决定角色拼合细腻度与 GPU 开销 */
export const PARTICLE_COUNT = 12000;

/** 单粒子尺寸：粒子数多时调小，避免重叠糊成一团、保留锐利细节 */
export const PARTICLE_SIZE = 2.3;

/** 开场散落球面半径（粒子先聚成球面再过渡到角色） */
export const SPHERE_RADIUS = 200;

/** 鼠标排斥半径（粒子被推开的生效范围） */
export const REPEL_RADIUS = 130;

/** 鼠标排斥强度系数 */
export const REPEL_STRENGTH = 70;

/** 角色图采样时最长边归一化的像素尺寸（three 空间单位） */
export const CHARACTER_MAX_EDGE = 440;

/** 角色形态下每个粒子的 z 向厚度抖动上限（让 2D 角色具备 2.5D 体积感） */
export const CHARACTER_DEPTH = 14;

/** 角色常驻态绕 y 轴的小幅摆动幅度（rad），过大角色会变扁 */
export const SWING_AMP = 0.14;

/** 形态切换时长（ms）：散落球面 ↔ 角色 */
export const MORPH_DURATION = 1100;

/** wink 时长（ms）：离开挽留时的一次俏皮纵向收缩 */
export const WINK_DURATION = 720;

/** 角色图资源路径 */
export const CHARACTER_SRC = '/character.png';
