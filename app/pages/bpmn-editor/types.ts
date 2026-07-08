import type { RefObject } from 'react';
import type { UploadProps } from 'antd';

/** 选中元素信息 */
export interface SelectedElement {
    id: string;
    type: string;
    name: string;
}

/** 缩放动作 */
export type ZoomAction = 'in' | 'out' | 'fit' | 'reset';

/** 导出格式 */
export type ExportFormat = 'bpmn' | 'svg';

/** 预置模板键 */
export type TemplateKey = 'simple-approval';

/**
 * BPMN 编辑器控制器：useBpmnEditor 的对外契约
 * 组件层只依赖此接口，不直接访问 hook 内部实现
 */
export interface BpmnController {
    // —— DOM 引用 ——
    containerRef: RefObject<HTMLDivElement | null>;

    // —— 状态 ——
    selectedElement: SelectedElement | null;
    zoom: number;
    xmlModalOpen: boolean;
    currentXml: string;

    // —— 文件操作 ——
    handleUpload: UploadProps['beforeUpload'];
    handleDownload: (format: ExportFormat) => void;
    handleViewXml: () => void;
    handleNewDiagram: () => void;
    handleLoadTemplate: (key: TemplateKey) => void;

    // —— 画布操作 ——
    handleZoom: (action: ZoomAction) => void;
    handleUndo: () => void;
    handleRedo: () => void;

    // —— XML 弹窗 ——
    closeXmlModal: () => void;
    copyXml: () => void;
    downloadCurrentXml: () => void;
}
