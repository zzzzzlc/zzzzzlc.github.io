import type { WatermarkConfig, WatermarkMode, WatermarkPosition } from '../types';

/** 默认水印配置 */
export const DEFAULT_CONFIG: WatermarkConfig = {
    text: '机密文件 CONFIDENTIAL',
    fontSize: 16,
    color: '#000000',
    rotation: -22,
    gapX: 100,
    gapY: 100,
    opacity: 0.15,
    movable: false,
};

export interface ModeOption {
    label: string;
    value: WatermarkMode;
}

/** 模式选项 */
export const MODE_OPTIONS: ModeOption[] = [
    { label: '页面水印', value: 'page' },
    { label: '文件下载', value: 'file' },
    { label: '内容水印', value: 'content' },
];

export interface PositionOption {
    label: string;
    value: WatermarkPosition;
}

/** 定位选项（文件模式） */
export const POSITION_OPTIONS: PositionOption[] = [
    { label: '平铺', value: 'tile' },
    { label: '居中', value: 'center' },
    { label: '右下角', value: 'bottom-right' },
    { label: '左下角', value: 'bottom-left' },
    { label: '右上角', value: 'top-right' },
    { label: '左上角', value: 'top-left' },
];

/** antd Watermark 单格尺寸 */
export const WATERMARK_TILE_WIDTH = 120;
export const WATERMARK_TILE_HEIGHT = 64;

/** 示例文档内容 */
export const SAMPLE_TEXT: string[] = [
    '这是一段示例文档内容，用于演示页面水印效果。在实际应用中，水印通常用于保护敏感文档，防止未经授权的复制或截图传播。',
    '水印可以包含公司名称、用户信息、时间戳等标识内容。当文档被截图或拍照外传时，水印可以帮助追溯信息来源。',
    '本工具支持自定义水印文本、字体大小、颜色、旋转角度、透明度和间距等参数，满足不同场景的安全需求。',
    '除了文本水印外，系统还支持在图片上添加水印并导出，适用于图片版权保护和品牌标识。',
];
