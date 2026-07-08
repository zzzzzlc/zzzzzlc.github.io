import type { RefObject } from 'react';
import type { UploadProps } from 'antd';

/** 模型加载结果（由引擎返回，hook 据 message 决定提示） */
export interface LoadModelResult {
    success: boolean;
    message: string;
}

/**
 * 3D 查看器控制器：useThreeViewer 的对外契约
 * 组件层只依赖此接口，不直接访问 hook 内部实现与 three.js
 */
export interface ThreeViewerController {
    // —— DOM 引用 ——
    containerRef: RefObject<HTMLDivElement | null>;

    // —— 状态 ——
    autoRotate: boolean;
    wireframe: boolean;
    loading: boolean;

    // —— 操作 ——
    handleUpload: UploadProps['beforeUpload'];
    handleReset: () => void;
    handleAutoRotateChange: (checked: boolean) => void;
    handleWireframeChange: (checked: boolean) => void;
}
