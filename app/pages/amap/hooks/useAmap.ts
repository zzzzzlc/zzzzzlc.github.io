import { useCallback, useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import type { AmapController, EndpointKey, MapStyle, PoiItem, RouteProfile, RouteResult } from '../types';
import { createMap, type MapEngine } from '../services/mapEngine';
import { planRoute as planRouteService, searchPois } from '../services/geoService';
import { formatDistance, formatDuration } from '../utils/format';
import { LOCATE_ZOOM, SELECT_ZOOM } from '../utils/constants';

/**
 * 地图导航核心逻辑聚合 hook：
 * 持有全部状态、地图引擎引用与选点 / 搜索 / 路线规划逻辑，对外暴露统一控制器
 */
export const useAmap = (): AmapController => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapEngineRef = useRef<MapEngine | null>(null);
    // pickPointRef 跟踪最新 handlePickPoint：地图 click 回调在 init effect 内仅注册一次，
    // 通过 ref 始终调用最新版本，确保 pickingFor 变化能同步到地图点击副作用（修复原 stale-closure）
    const pickPointRef = useRef<((poi: PoiItem) => void) | null>(null);

    const [style, setStyle] = useState<MapStyle>('standard');
    const [profile, setProfile] = useState<RouteProfile>('driving');
    const [pickingFor, setPickingFor] = useState<EndpointKey>('start');
    const [startQuery, setStartQuery] = useState('');
    const [endQuery, setEndQuery] = useState('');
    const [startPoint, setStartPoint] = useState<PoiItem | null>(null);
    const [endPoint, setEndPoint] = useState<PoiItem | null>(null);
    const [searchResults, setSearchResults] = useState<PoiItem[]>([]);
    const [searchingFor, setSearchingFor] = useState<EndpointKey>('start');
    const [route, setRoute] = useState<RouteResult | null>(null);
    const [loading, setLoading] = useState(false);

    // 通用：设置起点/终点 marker（由 pickingFor 决定写入哪一端）
    const handlePickPoint = useCallback((poi: PoiItem) => {
        const engine = mapEngineRef.current;
        if (!engine) return;
        const key = pickingFor;
        engine.setEndpointMarker(key, poi);
        if (key === 'start') {
            setStartPoint(poi);
            setStartQuery(poi.name);
        } else {
            setEndPoint(poi);
            setEndQuery(poi.name);
        }
        setPickingFor(key === 'start' ? 'end' : 'start');
    }, [pickingFor]);

    // 每次渲染同步最新 handlePickPoint 到 ref，供 init effect 注册的 click 回调调用
    useEffect(() => {
        pickPointRef.current = handlePickPoint;
    }, [handlePickPoint]);

    // 初始化地图（仅一次）
    useEffect(() => {
        if (!containerRef.current) return;
        const engine = createMap(containerRef.current);
        engine.onMapClick((poi) => pickPointRef.current?.(poi));
        mapEngineRef.current = engine;
        return () => {
            engine.destroy();
            mapEngineRef.current = null;
        };
    }, []);

    const switchStyle = useCallback((newStyle: MapStyle) => {
        setStyle(newStyle);
        mapEngineRef.current?.setTileSource(newStyle);
    }, []);

    const focusEndpoint = useCallback((key: EndpointKey) => {
        setPickingFor(key);
        setSearchingFor(key);
    }, []);

    // 地理编码搜索
    const handleSearch = useCallback(async (keyword: string, target: EndpointKey) => {
        if (!keyword.trim()) return;
        setSearchingFor(target);
        setLoading(true);
        try {
            const pois = await searchPois(keyword);
            if (!pois.length) {
                message.info('未找到相关结果');
                setSearchResults([]);
                return;
            }
            setSearchResults(pois);
        } catch (e) {
            console.error(e);
            message.error('搜索失败，请稍后重试');
        } finally {
            setLoading(false);
        }
    }, []);

    const selectPoi = useCallback((poi: PoiItem) => {
        setSearchResults([]);
        handlePickPoint(poi);
        mapEngineRef.current?.flyTo(poi.lng, poi.lat, SELECT_ZOOM);
    }, [handlePickPoint]);

    // 路线规划
    const planRoute = useCallback(async () => {
        if (!startPoint || !endPoint) {
            message.warning('请先选择起点和终点');
            return;
        }
        setLoading(true);
        try {
            const result = await planRouteService(startPoint, endPoint, profile);
            if (!result) {
                message.error('路线规划失败');
                return;
            }
            const engine = mapEngineRef.current;
            if (!engine) return;
            engine.drawRoute(result.geometry);
            engine.fitRouteBounds(result.geometry.coordinates);
            setRoute(result);
            message.success(`规划成功：${formatDistance(result.distance)}，预计 ${formatDuration(result.duration)}`);
        } catch (e) {
            console.error(e);
            message.error('路线规划失败，请稍后重试');
        } finally {
            setLoading(false);
        }
    }, [startPoint, endPoint, profile]);

    const swapEndpoints = useCallback(() => {
        if (!startPoint || !endPoint) return;
        setStartPoint(endPoint);
        setStartQuery(endQuery);
        setEndPoint(startPoint);
        setEndQuery(startQuery);
        mapEngineRef.current?.swapEndpointMarkers();
    }, [startPoint, endPoint, startQuery, endQuery]);

    const clearAll = useCallback(() => {
        mapEngineRef.current?.clearMarkers();
        mapEngineRef.current?.clearRoute();
        setStartPoint(null);
        setEndPoint(null);
        setStartQuery('');
        setEndQuery('');
        setRoute(null);
        setSearchResults([]);
    }, []);

    const locate = useCallback(() => {
        if (!navigator.geolocation) {
            message.error('浏览器不支持定位');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const poi: PoiItem = {
                    name: '当前位置',
                    lng: pos.coords.longitude,
                    lat: pos.coords.latitude,
                };
                mapEngineRef.current?.flyTo(poi.lng, poi.lat, LOCATE_ZOOM);
                // 定位明确写入起点（不依赖 pickingFor，避免 setState 异步导致写错端）
                mapEngineRef.current?.setEndpointMarker('start', poi);
                setStartPoint(poi);
                setStartQuery(poi.name);
                setPickingFor('end');
                message.success('已定位到当前位置');
            },
            () => message.error('定位失败，请检查权限'),
            { enableHighAccuracy: true, timeout: 10000 },
        );
    }, []);

    return {
        containerRef,
        style, profile, startQuery, endQuery, startPoint, endPoint,
        searchResults, searchingFor, route, loading,
        canSwap: !!startPoint && !!endPoint,
        setProfile, setStartQuery, setEndQuery,
        switchStyle, focusEndpoint, handleSearch, selectPoi,
        planRoute, swapEndpoints, clearAll, locate,
    };
};
