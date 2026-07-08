import type { EndpointKey, MapStyle } from '../types';

/**
 * 不同的栅格瓦片源——演示 WebGIS 切换底图数据源
 */
export const TILE_SOURCES: Record<MapStyle, { url: string; attribution: string }> = {
    standard: {
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '© OpenStreetMap contributors',
    },
    satellite: {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: '© Esri World Imagery',
    },
    dark: {
        url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        attribution: '© CARTO © OpenStreetMap contributors',
    },
};

/** 起终点 marker 颜色 */
export const MARKER_COLORS: Record<EndpointKey, string> = {
    start: '#16a34a',
    end: '#dc2626',
};

/** 初始视点：北京天安门 [lng, lat] */
export const INITIAL_CENTER: [number, number] = [116.397428, 39.90923];

/** 初始缩放级别 */
export const INITIAL_ZOOM = 11;

/** 路线规划选中后飞行的缩放级别 */
export const SELECT_ZOOM = 13;

/** 定位成功后的缩放级别 */
export const LOCATE_ZOOM = 14;

/** 路线视口适配内边距 */
export const ROUTE_FIT_PADDING = 80;

/** 栅格瓦片 source / layer 标识 */
export const RASTER_SOURCE_ID = 'raster-tiles';
export const RASTER_LAYER_ID = 'background';
export const ROUTE_SOURCE_ID = 'route';
export const ROUTE_LAYER_ID = 'route-line';

/** Nominatim 地理编码服务地址 */
export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/** OSRM 路由服务地址 */
export const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1';
