import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { Card, Typography, Input, Button, Space, message, Segmented, Radio, List } from 'antd';
import {
    SearchOutlined,
    EnvironmentOutlined,
    AimOutlined,
    ArrowRightOutlined,
    SwapOutlined,
} from '@ant-design/icons';

const { Search, Text } = { Search: Input.Search, Text: Typography.Text };

type MapStyle = 'standard' | 'satellite' | 'dark';
type RouteProfile = 'driving' | 'walking' | 'cycling';
type EndpointKey = 'start' | 'end';

interface PoiItem {
    name: string;
    display_name?: string;
    lng: number;
    lat: number;
}

interface RouteStep {
    instruction: string;
    distance: number;
    duration: number;
    name: string;
}

interface RouteResult {
    distance: number; // 米
    duration: number; // 秒
    geometry: { type: 'LineString'; coordinates: [number, number][] };
    steps: RouteStep[];
}

/**
 * 不同的栅格瓦片源——演示 WebGIS 切换底图数据源
 */
const TILE_SOURCES: Record<MapStyle, { url: string; attribution: string }> = {
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

const formatDuration = (sec: number) => {
    if (sec < 60) return `${Math.round(sec)} 秒`;
    const m = Math.round(sec / 60);
    if (m < 60) return `${m} 分钟`;
    const h = Math.floor(m / 60);
    return `${h} 小时 ${m % 60} 分钟`;
};

const formatDistance = (m: number) => (m < 1000 ? `${Math.round(m)} 米` : `${(m / 1000).toFixed(1)} 公里`);

export default function WebGisView() {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const markersRef = useRef<Record<EndpointKey, maplibregl.Marker | null>>({
        start: null,
        end: null,
    });
    const popupRef = useRef<maplibregl.Popup | null>(null);

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

    // 初始化地图
    useEffect(() => {
        if (!containerRef.current) return;

        const map = new maplibregl.Map({
            container: containerRef.current,
            style: {
                version: 8,
                sources: {
                    'raster-tiles': {
                        type: 'raster',
                        tiles: [TILE_SOURCES.standard.url],
                        tileSize: 256,
                        attribution: TILE_SOURCES.standard.attribution,
                    },
                },
                layers: [
                    {
                        id: 'background',
                        type: 'raster',
                        source: 'raster-tiles',
                        minzoom: 0,
                        maxzoom: 22,
                    },
                ],
            },
            center: [116.397428, 39.90923], // 北京天安门 [lng, lat]
            zoom: 11,
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-left');
        map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

        // 点击地图选点
        map.on('click', (e) => {
            const poi: PoiItem = {
                name: `点位 ${e.lngLat.lng.toFixed(4)}, ${e.lngLat.lat.toFixed(4)}`,
                lng: e.lngLat.lng,
                lat: e.lngLat.lat,
            };
            handlePickPoint(poi);
        });

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // 切换底图样式
    const switchStyle = (newStyle: MapStyle) => {
        setStyle(newStyle);
        const map = mapRef.current;
        if (!map) return;
        const source = map.getSource('raster-tiles') as maplibregl.RasterTileSource | undefined;
        if (source) {
            source.setTiles([TILE_SOURCES[newStyle].url]);
        }
    };

    // 通用：设置起点/终点 marker
    const handlePickPoint = (poi: PoiItem) => {
        const key = pickingFor;
        const color = key === 'start' ? '#16a34a' : '#dc2626';
        const map = mapRef.current;
        if (!map) return;

        // 清理旧 marker
        markersRef.current[key]?.remove();

        const el = document.createElement('div');
        el.style.cssText = `width:18px;height:18px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid #fff;`;
        const marker = new maplibregl.Marker({ element: el })
            .setLngLat([poi.lng, poi.lat])
            .addTo(map);

        markersRef.current[key] = marker;

        if (key === 'start') {
            setStartPoint(poi);
            setStartQuery(poi.name);
        } else {
            setEndPoint(poi);
            setEndQuery(poi.name);
        }

        // 自动切换到另一个端点
        setPickingFor(key === 'start' ? 'end' : 'start');
    };

    // 地理编码搜索（Nominatim 免费 OSM 服务）
    const handleSearch = async (keyword: string, target: EndpointKey) => {
        if (!keyword.trim()) return;
        setSearchingFor(target);
        setLoading(true);
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(keyword)}`,
                { headers: { 'Accept-Language': 'zh-CN' } }
            );
            const data = await res.json();
            if (!data.length) {
                message.info('未找到相关结果');
                setSearchResults([]);
                return;
            }
            const pois: PoiItem[] = data.map((item: any) => ({
                name: item.name || item.display_name.split(',')[0],
                display_name: item.display_name,
                lng: parseFloat(item.lon),
                lat: parseFloat(item.lat),
            }));
            setSearchResults(pois);
        } catch (e) {
            console.error(e);
            message.error('搜索失败，请稍后重试');
        } finally {
            setLoading(false);
        }
    };

    const selectPoi = (poi: PoiItem) => {
        setSearchResults([]);
        handlePickPoint(poi);
        mapRef.current?.flyTo({ center: [poi.lng, poi.lat], zoom: 13 });
    };

    // 路线规划（OSRM 公共服务）
    const planRoute = async () => {
        if (!startPoint || !endPoint) {
            message.warning('请先选择起点和终点');
            return;
        }
        setLoading(true);
        try {
            const coordStr = `${startPoint.lng},${startPoint.lat};${endPoint.lng},${endPoint.lat}`;
            const url = `https://router.project-osrm.org/route/v1/${profile}/${coordStr}?overview=full&geometries=geojson&steps=true`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.code !== 'Ok' || !data.routes?.length) {
                message.error('路线规划失败');
                return;
            }

            const r = data.routes[0];
            const steps: RouteStep[] = (r.legs?.[0]?.steps || []).map((s: any) => ({
                instruction: buildInstruction(s.maneuver),
                distance: s.distance,
                duration: s.duration,
                name: s.name,
            }));

            const geometry = {
                type: 'LineString' as const,
                coordinates: r.geometry.coordinates as [number, number][],
            };

            const map = mapRef.current!;
            // 移除旧路线
            if (map.getLayer('route-line')) map.removeLayer('route-line');
            if (map.getSource('route')) map.removeSource('route');

            map.addSource('route', {
                type: 'geojson',
                data: { type: 'Feature', properties: {}, geometry },
            });
            map.addLayer({
                id: 'route-line',
                type: 'line',
                source: 'route',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': '#1677ff',
                    'line-width': 5,
                    'line-opacity': 0.85,
                },
            });

            // 视口适配
            const routeCoords = r.geometry.coordinates as [number, number][];
            const bounds = routeCoords.reduce(
                (b: maplibregl.LngLatBounds, c: [number, number]) => b.extend(c),
                new maplibregl.LngLatBounds(routeCoords[0], routeCoords[0])
            );
            map.fitBounds(bounds, { padding: 80 });

            setRoute({ distance: r.distance, duration: r.duration, geometry, steps });
            message.success(`规划成功：${formatDistance(r.distance)}，预计 ${formatDuration(r.duration)}`);
        } catch (e) {
            console.error(e);
            message.error('路线规划失败，请稍后重试');
        } finally {
            setLoading(false);
        }
    };

    const buildInstruction = (maneuver: any) => {
        const type = maneuver?.type;
        const mod = maneuver?.modifier;
        const map: Record<string, string> = {
            depart: '出发',
            arrive: '到达目的地',
            turn: `向${mod === 'left' ? '左' : mod === 'right' ? '右' : mod}转`,
            continue: '继续直行',
            merge: `汇入${mod === 'left' ? '左侧' : '右侧'}道路`,
            'new name': '进入新道路',
            end: '结束',
        };
        return map[type] || (type === 'turn' ? '转弯' : '前行');
    };

    const swapEndpoints = () => {
        if (!startPoint || !endPoint) return;
        const tmpPoint = startPoint;
        const tmpQuery = startQuery;
        setStartPoint(endPoint);
        setStartQuery(endQuery);
        setEndPoint(tmpPoint);
        setEndQuery(tmpQuery);
        // marker 也交换
        const tmpMarker = markersRef.current.start;
        markersRef.current.start = markersRef.current.end;
        markersRef.current.end = tmpMarker;
    };

    const clearAll = () => {
        Object.values(markersRef.current).forEach(m => m?.remove());
        markersRef.current = { start: null, end: null };
        const map = mapRef.current;
        if (map) {
            if (map.getLayer('route-line')) map.removeLayer('route-line');
            if (map.getSource('route')) map.removeSource('route');
        }
        setStartPoint(null);
        setEndPoint(null);
        setStartQuery('');
        setEndQuery('');
        setRoute(null);
        setSearchResults([]);
    };

    const locate = () => {
        if (!navigator.geolocation) {
            message.error('浏览器不支持定位');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            pos => {
                const poi: PoiItem = {
                    name: '当前位置',
                    lng: pos.coords.longitude,
                    lat: pos.coords.latitude,
                };
                mapRef.current?.flyTo({ center: [poi.lng, poi.lat], zoom: 14 });
                setPickingFor('start');
                handlePickPoint(poi);
                message.success('已定位到当前位置');
            },
            () => message.error('定位失败，请检查权限'),
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    return (
        <div>
            <Typography.Title level={3} style={{ marginBottom: 8 }}>地图导航 · WebGIS</Typography.Title>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                底图：OpenStreetMap · 地理编码：Nominatim · 路由：OSRM（开源，无需 Key）
            </Typography.Text>

            <Card style={{ marginBottom: 12 }}>
                <Space wrap size="middle" align="center">
                    <Text strong>路线模式：</Text>
                    <Radio.Group
                        value={profile}
                        onChange={e => setProfile(e.target.value)}
                        optionType="button"
                        buttonStyle="solid"
                        size="small"
                    >
                        <Radio.Button value="driving">驾车</Radio.Button>
                        <Radio.Button value="walking">步行</Radio.Button>
                        <Radio.Button value="cycling">骑行</Radio.Button>
                    </Radio.Group>

                    <Segmented
                        value={style}
                        onChange={(v) => switchStyle(v as MapStyle)}
                        options={[
                            { label: '标准', value: 'standard' },
                            { label: '卫星', value: 'satellite' },
                            { label: '暗色', value: 'dark' },
                        ]}
                    />

                    <Button icon={<AimOutlined />} onClick={locate} size="small">定位</Button>
                    <Button onClick={clearAll} size="small">清空</Button>
                </Space>
            </Card>

            <Card style={{ marginBottom: 12 }}>
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                    <Search
                        placeholder="起点：搜索地点或点击地图"
                        value={startQuery}
                        onChange={e => setStartQuery(e.target.value)}
                        onSearch={v => handleSearch(v, 'start')}
                        onFocus={() => { setPickingFor('start'); setSearchingFor('start'); }}
                        enterButton={
                            <Button type="primary" size="small" icon={<SearchOutlined />}>起点</Button>
                        }
                        allowClear
                    />
                    <Space style={{ width: '100%' }}>
                        <Button
                            icon={<SwapOutlined />}
                            onClick={swapEndpoints}
                            size="small"
                            disabled={!startPoint || !endPoint}
                        >
                            交换
                        </Button>
                        <Button
                            type="primary"
                            icon={<ArrowRightOutlined />}
                            onClick={planRoute}
                            loading={loading}
                            disabled={!startPoint || !endPoint}
                        >
                            规划路线
                        </Button>
                        {startPoint && endPoint && (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                起点：{startPoint.name} → 终点：{endPoint.name}
                            </Text>
                        )}
                    </Space>
                    <Search
                        placeholder="终点：搜索地点或点击地图"
                        value={endQuery}
                        onChange={e => setEndQuery(e.target.value)}
                        onSearch={v => handleSearch(v, 'end')}
                        onFocus={() => { setPickingFor('end'); setSearchingFor('end'); }}
                        enterButton={
                            <Button danger size="small" icon={<SearchOutlined />}>终点</Button>
                        }
                        allowClear
                    />
                </Space>
            </Card>

            {searchResults.length > 0 && (
                <Card
                    title={
                        <Space>
                            <EnvironmentOutlined />
                            搜索结果（{searchingFor === 'start' ? '起点' : '终点'}）
                        </Space>
                    }
                    style={{ marginBottom: 12 }}
                    size="small"
                >
                    <List
                        size="small"
                        dataSource={searchResults}
                        renderItem={poi => (
                            <List.Item
                                style={{ cursor: 'pointer', padding: '6px 8px' }}
                                onClick={() => selectPoi(poi)}
                            >
                                <List.Item.Meta
                                    title={poi.name}
                                    description={
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            {poi.display_name}
                                        </Text>
                                    }
                                />
                            </List.Item>
                        )}
                    />
                </Card>
            )}

            {route && (
                <Card
                    title={
                        <Space>
                            <ArrowRightOutlined />
                            导航结果
                        </Space>
                    }
                    style={{ marginBottom: 12 }}
                    size="small"
                >
                    <Space size="large" style={{ marginBottom: 8 }}>
                        <Text strong style={{ color: '#1677ff' }}>
                            {formatDistance(route.distance)}
                        </Text>
                        <Text strong style={{ color: '#1677ff' }}>
                            {formatDuration(route.duration)}
                        </Text>
                    </Space>
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                        <List
                            size="small"
                            dataSource={route.steps}
                            renderItem={(step, idx) => (
                                <List.Item style={{ padding: '4px 0' }}>
                                    <Text>
                                        <Text type="secondary">{idx + 1}.</Text>{' '}
                                        {step.instruction}
                                        {step.name && `，进入${step.name}`}
                                        {step.distance > 0 && (
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                {' '}（{formatDistance(step.distance)}）
                                            </Text>
                                        )}
                                    </Text>
                                </List.Item>
                            )}
                        />
                    </div>
                </Card>
            )}

            <Card styles={{ body: { padding: 0, overflow: 'hidden' } }}>
                <div ref={containerRef} style={{ width: '100%', height: '70vh' }} />
            </Card>
        </div>
    );
}
