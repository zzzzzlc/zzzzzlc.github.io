import type { RefObject } from 'react';

/** 栅格底图样式 */
export type MapStyle = 'standard' | 'satellite' | 'dark';

/** 路线规划模式 */
export type RouteProfile = 'driving' | 'walking' | 'cycling';

/** 起终点标识 */
export type EndpointKey = 'start' | 'end';

/** 兴趣点（地理编码结果 / 地图选点） */
export interface PoiItem {
    name: string;
    display_name?: string;
    lng: number;
    lat: number;
}

/** 路线导航单步指令 */
export interface RouteStep {
    instruction: string;
    distance: number;
    duration: number;
    name: string;
}

/** 路线几何（GeoJSON LineString 子集） */
export interface RouteGeometry {
    type: 'LineString';
    coordinates: [number, number][];
}

/** 路线规划结果 */
export interface RouteResult {
    distance: number; // 米
    duration: number; // 秒
    geometry: RouteGeometry;
    steps: RouteStep[];
}

/** OSRM maneuver 描述（最小精确类型，替代原 any） */
export interface RouteManeuver {
    type: string;
    modifier?: string;
}

/**
 * 地图导航控制器：useAmap 的对外契约
 * 组件层只依赖此接口，不直接访问 hook 内部实现与 maplibre-gl
 */
export interface AmapController {
    // —— DOM 引用 ——
    containerRef: RefObject<HTMLDivElement | null>;

    // —— 状态 ——
    style: MapStyle;
    profile: RouteProfile;
    startQuery: string;
    endQuery: string;
    startPoint: PoiItem | null;
    endPoint: PoiItem | null;
    searchResults: PoiItem[];
    searchingFor: EndpointKey;
    route: RouteResult | null;
    loading: boolean;

    // —— 派生 ——
    canSwap: boolean;

    // —— 操作 ——
    setProfile: (profile: RouteProfile) => void;
    setStartQuery: (q: string) => void;
    setEndQuery: (q: string) => void;
    switchStyle: (style: MapStyle) => void;
    focusEndpoint: (key: EndpointKey) => void;
    handleSearch: (keyword: string, target: EndpointKey) => void;
    selectPoi: (poi: PoiItem) => void;
    planRoute: () => void;
    swapEndpoints: () => void;
    clearAll: () => void;
    locate: () => void;
}
