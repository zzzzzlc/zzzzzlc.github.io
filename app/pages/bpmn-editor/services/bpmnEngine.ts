import BpmnModeler from 'bpmn-js/lib/Modeler';

/** 选中变化事件载荷 */
export interface SelectionChangedEvent {
    newSelection: Array<{
        id: string;
        type: string;
        businessObject?: { name?: string };
    }>;
}

/** 画布视口变化事件载荷 */
export interface ViewboxChangedEvent {
    viewbox: { scale: number };
}

/**
 * diagram-js Canvas 模块（仅声明使用到的成员）
 * 修正 zoom 的 center 参数：运行时接受 'auto'，但 diagram-js 类型仅声明了 Point
 */
export interface BpmnCanvas {
    zoom: (newScale?: number | 'fit-viewport', center?: { x: number; y: number } | 'auto') => number;
}

/**
 * diagram-js EventBus 模块（仅声明使用到的成员）
 * 泛型 T 对应事件载荷类型，由调用方显式指定
 */
export interface BpmnEventBus {
    on: <T>(event: string, callback: (e: T) => void) => void;
}

/** diagram-js CommandStack 模块（仅声明使用到的成员） */
export interface BpmnCommandStack {
    undo: () => void;
    redo: () => void;
}

/**
 * BPMN 引擎句柄：封装 bpmn-js Modeler 的所有交互
 * 组件 / hook 不直接 new BpmnModeler，统一经此收口
 */
export interface BpmnEngine {
    importXml: (xml: string) => Promise<void>;
    saveXml: (format: boolean) => Promise<string | undefined>;
    saveSvg: () => Promise<string>;
    getCanvas: () => BpmnCanvas;
    getEventBus: () => BpmnEventBus;
    getCommandStack: () => BpmnCommandStack;
    destroy: () => void;
}

/**
 * 创建 BPMN 引擎：实例化 Modeler 并返回统一操作句柄
 * 引擎创建与销毁在此收口，组件层不直接接触 bpmn-js
 */
export const createBpmnEngine = (container: HTMLElement): BpmnEngine => {
    const modeler = new BpmnModeler({
        container,
        // keyboard binding 现已 implicit（diagram-js#661），不再显式 bindTo
    });

    return {
        importXml: async (xml) => {
            await modeler.importXML(xml);
        },
        saveXml: async (format) => {
            const { xml } = await modeler.saveXML({ format });
            return xml;
        },
        saveSvg: async () => {
            const { svg } = await modeler.saveSVG();
            return svg;
        },
        getCanvas: () => modeler.get<BpmnCanvas>('canvas'),
        getEventBus: () => modeler.get<BpmnEventBus>('eventBus'),
        getCommandStack: () => modeler.get<BpmnCommandStack>('commandStack'),
        destroy: () => modeler.destroy(),
    };
};
