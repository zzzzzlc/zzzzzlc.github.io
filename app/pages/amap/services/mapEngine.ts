import maplibregl from 'maplibre-gl';
import type { EndpointKey, MapStyle, PoiItem, RouteGeometry } from '../types';
import {
    INITIAL_CENTER, INITIAL_ZOOM, MARKER_COLORS,
    RASTER_LAYER_ID, RASTER_SOURCE_ID, ROUTE_FIT_PADDING, ROUTE_LAYER_ID,
    ROUTE_SOURCE_ID, TILE_SOURCES,
} from '../utils/constants';

/**
 * 地图引擎句柄：封装 maplibre-gl 实例与所有地图操作
 * 组件 / hook 不直接 import maplibre-gl，统一经由本引擎
 */
export interface MapEngine {
    destroy: () => void;
    /** 注册地图点击选点回调（可重复调用以更新为最新闭包） */
    onMapClick: (handler: (poi: PoiItem) => void) => void;
    /** 切换栅格底图源 */
    setTileSource: (style: MapStyle) => void;
    /** 飞行到指定坐标 */
    flyTo: (lng: number, lat: number, zoom: number) => void;
    /** 设置 / 替换起终点 marker */
    setEndpointMarker: (key: EndpointKey, poi: PoiItem) => void;
    /** 交换起点与终点 marker（不重建） */
    swapEndpointMarkers: () => void;
    /** 移除全部 marker */
    clearMarkers: () => void;
    /** 绘制路线（覆盖旧路线） */
    drawRoute: (geometry: RouteGeometry) => void;
    /** 移除路线图层与数据源 */
    clearRoute: () => void;
    /** 视口适配路线坐标 */
    fitRouteBounds: (coordinates: [number, number][]) => void;
}

const MARKER_PIN_STYLE =
    'width:18px;height:18px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);' +
    'box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid #fff;';

/**
 * 创建 maplibre-gl 地图实例并装配控件，返回统一引擎句柄
 * 第三方库实例化在此收口
 */
export const createMap = (container: HTMLDivElement): MapEngine => {
    const map = new maplibregl.Map({
        container,
        style: {
            version: 8,
            sources: {
                [RASTER_SOURCE_ID]: {
                    type: 'raster',
                    tiles: [TILE_SOURCES.standard.url],
                    tileSize: 256,
                    attribution: TILE_SOURCES.standard.attribution,
                },
            },
            layers: [{
                id: RASTER_LAYER_ID,
                type: 'raster',
                source: RASTER_SOURCE_ID,
                minzoom: 0,
                maxzoom: 22,
            }],
        },
        center: INITIAL_CENTER,
        zoom: INITIAL_ZOOM,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-left');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    let clickHandler: ((poi: PoiItem) => void) | null = null;
    map.on('click', (e) => {
        const poi: PoiItem = {
            name: `点位 ${e.lngLat.lng.toFixed(4)}, ${e.lngLat.lat.toFixed(4)}`,
            lng: e.lngLat.lng,
            lat: e.lngLat.lat,
        };
        clickHandler?.(poi);
    });

    const markers: Record<EndpointKey, maplibregl.Marker | null> = { start: null, end: null };

    const removeLayerIfExist = (id: string) => {
        if (map.getLayer(id)) map.removeLayer(id);
    };
    const removeSourceIfExist = (id: string) => {
        if (map.getSource(id)) map.removeSource(id);
    };

    return {
        destroy: () => map.remove(),
        onMapClick: (handler) => { clickHandler = handler; },
        setTileSource: (style) => {
            const source = map.getSource(RASTER_SOURCE_ID) as maplibregl.RasterTileSource | undefined;
            source?.setTiles([TILE_SOURCES[style].url]);
        },
        flyTo: (lng, lat, zoom) => map.flyTo({ center: [lng, lat], zoom }),
        setEndpointMarker: (key, poi) => {
            markers[key]?.remove();
            const el = document.createElement('div');
            el.style.cssText = `background:${MARKER_COLORS[key]};${MARKER_PIN_STYLE}`;
            const marker = new maplibregl.Marker({ element: el })
                .setLngLat([poi.lng, poi.lat])
                .addTo(map);
            markers[key] = marker;
        },
        swapEndpointMarkers: () => {
            const tmp = markers.start;
            markers.start = markers.end;
            markers.end = tmp;
        },
        clearMarkers: () => {
            markers.start?.remove();
            markers.end?.remove();
            markers.start = null;
            markers.end = null;
        },
        drawRoute: (geometry) => {
            removeLayerIfExist(ROUTE_LAYER_ID);
            removeSourceIfExist(ROUTE_SOURCE_ID);
            map.addSource(ROUTE_SOURCE_ID, {
                type: 'geojson',
                data: { type: 'Feature', properties: {}, geometry },
            });
            map.addLayer({
                id: ROUTE_LAYER_ID,
                type: 'line',
                source: ROUTE_SOURCE_ID,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': '#1677ff',
                    'line-width': 5,
                    'line-opacity': 0.85,
                },
            });
        },
        clearRoute: () => {
            removeLayerIfExist(ROUTE_LAYER_ID);
            removeSourceIfExist(ROUTE_SOURCE_ID);
        },
        fitRouteBounds: (coordinates) => {
            const bounds = coordinates.reduce(
                (b, c) => b.extend(c),
                new maplibregl.LngLatBounds(coordinates[0], coordinates[0]),
            );
            map.fitBounds(bounds, { padding: ROUTE_FIT_PADDING });
        },
    };
};
