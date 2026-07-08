import { useCallback, useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import type { UploadProps } from 'antd';
import type { ThreeViewerController } from '../types';
import { createThreeEngine, type ThreeEngine } from '../services/threeEngine';

/**
 * 3D 查看器核心逻辑聚合 hook：
 * 持有引擎引用、状态与交互逻辑，对外暴露统一控制器
 */
export const useThreeViewer = (): ThreeViewerController => {
    const containerRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<ThreeEngine | null>(null);

    const [autoRotate, setAutoRotate] = useState(true);
    const [wireframe, setWireframe] = useState(false);
    const [loading, setLoading] = useState(false);

    // 初始化 three.js 引擎（仅一次）
    useEffect(() => {
        if (!containerRef.current) return;
        const engine = createThreeEngine(containerRef.current);
        engineRef.current = engine;
        return () => {
            engine.destroy();
            engineRef.current = null;
        };
    }, []);

    // 上传模型：同步返回 false 阻止 Upload 默认行为，异步加载模型
    // 注意：handleUpload 直接读取闭包内 wireframe，确保加载时按当前线框状态决定是否补材质
    const handleUpload: UploadProps['beforeUpload'] = (file) => {
        const engine = engineRef.current;
        if (!engine) return false;
        setLoading(true);
        void engine
            .loadModel(file, wireframe)
            .then((result) => {
                if (result.success) message.success(result.message);
                else message.error(result.message);
            })
            .finally(() => setLoading(false));
        return false;
    };

    const handleReset = useCallback(() => {
        engineRef.current?.resetModel();
    }, []);

    const handleAutoRotateChange = useCallback((checked: boolean) => {
        setAutoRotate(checked);
        engineRef.current?.setAutoRotate(checked);
    }, []);

    const handleWireframeChange = useCallback((checked: boolean) => {
        setWireframe(checked);
        engineRef.current?.setWireframe(checked);
    }, []);

    return {
        containerRef,
        autoRotate,
        wireframe,
        loading,
        handleUpload,
        handleReset,
        handleAutoRotateChange,
        handleWireframeChange,
    };
};
