import { useCallback, useEffect, useRef, useState } from 'react';
import { message, Modal } from 'antd';
import type { UploadProps } from 'antd';
import type { BpmnController, ExportFormat, SelectedElement, TemplateKey, ZoomAction } from '../types';
import {
    createBpmnEngine,
    type BpmnEngine,
    type SelectionChangedEvent,
    type ViewboxChangedEvent,
} from '../services/bpmnEngine';
import { EMPTY_DIAGRAM, TEMPLATES } from '../utils/constants';
import { downloadBlob } from '../utils/download';

/**
 * BPMN 编辑器核心逻辑聚合 hook：
 * 持有引擎引用、状态与事件处理，对外暴露统一控制器
 */
export const useBpmnEditor = (): BpmnController => {
    const containerRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<BpmnEngine | null>(null);
    const [currentXml, setCurrentXml] = useState('');
    const [xmlModalOpen, setXmlModalOpen] = useState(false);
    const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
    const [zoom, setZoom] = useState(1);

    // 初始化 BPMN 引擎：加载空白流程 + 绑定事件
    useEffect(() => {
        if (!containerRef.current) return;

        const engine = createBpmnEngine(containerRef.current);
        engineRef.current = engine;

        // 加载空白流程
        engine.importXml(EMPTY_DIAGRAM).then(() => {
            const canvas = engine.getCanvas();
            canvas.zoom('fit-viewport', 'auto');
            setZoom(Math.round(canvas.zoom() * 100));
        }).catch((err: Error) => {
            message.error('初始化流程图失败: ' + err.message);
        });

        // 监听元素选中
        const eventBus = engine.getEventBus();
        eventBus.on<SelectionChangedEvent>('selection.changed', (e) => {
            const selection = e.newSelection;
            if (selection && selection.length === 1) {
                const el = selection[0];
                setSelectedElement({
                    id: el.id,
                    type: el.type?.replace('bpmn:', '') || '',
                    name: el.businessObject?.name || '',
                });
            } else {
                setSelectedElement(null);
            }
        });

        // 监听画布缩放
        eventBus.on<ViewboxChangedEvent>('canvas.viewbox.changed', (e) => {
            if (e.viewbox) setZoom(Math.round(e.viewbox.scale * 100));
        });

        return () => {
            engine.destroy();
        };
    }, []);

    // 导入 BPMN XML
    const handleImportXml = useCallback((xml: string) => {
        if (!engineRef.current) return;
        engineRef.current.importXml(xml).then(() => {
            const canvas = engineRef.current!.getCanvas();
            canvas.zoom('fit-viewport', 'auto');
            message.success('导入成功');
        }).catch((err: Error) => {
            message.error('导入失败: ' + err.message);
        });
    }, []);

    // 上传文件
    const handleUpload: UploadProps['beforeUpload'] = (file) => {
        if (!file.name.endsWith('.bpmn') && !file.name.endsWith('.xml')) {
            message.error('请上传 .bpmn 或 .xml 文件');
            return false;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const xml = e.target?.result as string;
            handleImportXml(xml);
        };
        reader.readAsText(file);
        return false;
    };

    // 导出下载
    const handleDownload = useCallback(async (format: ExportFormat) => {
        if (!engineRef.current) return;
        try {
            if (format === 'bpmn') {
                const xml = await engineRef.current.saveXml(true);
                if (!xml) return;
                const blob = new Blob([xml], { type: 'application/xml' });
                downloadBlob(blob, 'diagram.bpmn');
                message.success('BPMN 文件已下载');
            } else {
                const svg = await engineRef.current.saveSvg();
                const blob = new Blob([svg], { type: 'image/svg+xml' });
                downloadBlob(blob, 'diagram.svg');
                message.success('SVG 图片已下载');
            }
        } catch {
            message.error('导出失败');
        }
    }, []);

    // 查看 XML
    const handleViewXml = useCallback(async () => {
        if (!engineRef.current) return;
        try {
            const xml = await engineRef.current.saveXml(true);
            if (xml) {
                setCurrentXml(xml);
                setXmlModalOpen(true);
            }
        } catch { /* ignore */ }
    }, []);

    // 缩放控制
    const handleZoom = useCallback((action: ZoomAction) => {
        if (!engineRef.current) return;
        const canvas = engineRef.current.getCanvas();
        switch (action) {
            case 'in': canvas.zoom(canvas.zoom() * 1.15); break;
            case 'out': canvas.zoom(canvas.zoom() / 1.15); break;
            case 'fit': canvas.zoom('fit-viewport', 'auto'); break;
            case 'reset': canvas.zoom(1); break;
        }
        setZoom(Math.round(canvas.zoom() * 100));
    }, []);

    // 撤销 / 重做
    const handleUndo = useCallback(() => {
        engineRef.current?.getCommandStack().undo();
    }, []);

    const handleRedo = useCallback(() => {
        engineRef.current?.getCommandStack().redo();
    }, []);

    // 清空画布
    const handleNewDiagram = useCallback(() => {
        Modal.confirm({
            title: '新建流程图',
            content: '当前内容将被清空，确认新建？',
            onOk: () => handleImportXml(EMPTY_DIAGRAM),
        });
    }, [handleImportXml]);

    // 加载模板
    const handleLoadTemplate = useCallback((key: TemplateKey) => {
        const xml = TEMPLATES[key];
        if (xml) {
            handleImportXml(xml);
            message.success('模板已加载');
        }
    }, [handleImportXml]);

    // XML 弹窗操作
    const closeXmlModal = useCallback(() => setXmlModalOpen(false), []);

    const copyXml = useCallback(() => {
        navigator.clipboard.writeText(currentXml);
        message.success('已复制到剪贴板');
    }, [currentXml]);

    const downloadCurrentXml = useCallback(() => {
        const blob = new Blob([currentXml], { type: 'application/xml' });
        downloadBlob(blob, 'diagram.bpmn');
    }, [currentXml]);

    return {
        containerRef,
        selectedElement,
        zoom,
        xmlModalOpen,
        currentXml,
        handleUpload,
        handleDownload,
        handleViewXml,
        handleZoom,
        handleUndo,
        handleRedo,
        handleNewDiagram,
        handleLoadTemplate,
        closeXmlModal,
        copyXml,
        downloadCurrentXml,
    };
};
