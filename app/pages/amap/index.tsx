import React, { useEffect, useRef, useState } from 'react';
import { Card, Typography, Input, Button, Space, message, Segmented } from 'antd';
import { SearchOutlined, AimOutlined, EnvironmentOutlined } from '@ant-design/icons';
import AMapLoader from '@amap/amap-jsapi-loader';

const { Search } = Input;

type MapMode = 'standard' | 'satellite' | 'dark';

interface PoiItem {
    name: string;
    address: string;
    location: { lng: number; lat: number };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function AMapView() {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const AMapRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    const [mode, setMode] = useState<MapMode>('standard');
    const [searchResults, setSearchResults] = useState<PoiItem[]>([]);
    const [center, setCenter] = useState('北京');

    useEffect(() => {
        const key = import.meta.env.VITE_AMAP_KEY;
        if (!key || key === 'your_amap_key_here') {
            message.warning('请先在 .env 中配置 VITE_AMAP_KEY');
        }

        AMapLoader.load({
            key: key || '',
            version: '2.0',
            plugins: [
                'AMap.PlaceSearch',
                'AMap.Geolocation',
                'AMap.Geocoder',
                'AMap.Scale',
                'AMap.ToolBar',
            ],
        }).then((AMap) => {
            AMapRef.current = AMap;

            const map = new AMap.Map(containerRef.current, {
                zoom: 12,
                center: [116.397428, 39.90923],
                viewMode: '3D',
            });

            map.addControl(new AMap.Scale());
            map.addControl(new AMap.ToolBar({ position: 'RB' }));

            mapRef.current = map;
        }).catch((e) => {
            console.error('地图加载失败:', e);
        });

        return () => {
            mapRef.current?.destroy();
        };
    }, []);

    const switchMapStyle = (newMode: MapMode) => {
        setMode(newMode);
        if (!mapRef.current) return;
        const styleMap: Record<MapMode, string> = {
            standard: 'normal',
            satellite: 'satellite',
            dark: 'dark',
        };
        mapRef.current.setMapStyle(`amap://styles/${styleMap[newMode]}`);
    };

    const clearMarkers = () => {
        markersRef.current.forEach(m => mapRef.current?.remove(m));
        markersRef.current = [];
    };

    const addMarker = (lng: number, lat: number, title: string) => {
        const AMap = AMapRef.current;
        if (!AMap || !mapRef.current) return;

        const marker = new AMap.Marker({
            position: [lng, lat],
            title,
            animation: 'AMAP_ANIMATION_DROP',
        });

        const infoWindow = new AMap.InfoWindow({
            content: `<div style="padding:8px;"><strong>${title}</strong></div>`,
            offset: new AMap.Pixel(0, -36),
        });

        marker.on('click', () => {
            infoWindow.open(mapRef.current, marker.getPosition());
        });

        mapRef.current.add(marker);
        markersRef.current.push(marker);
    };

    const handleSearch = (keyword: string) => {
        if (!keyword.trim()) return;
        const AMap = AMapRef.current;
        if (!AMap) { message.error('地图未加载完成'); return; }

        clearMarkers();

        const placeSearch = new AMap.PlaceSearch({
            pageSize: 10,
            pageIndex: 1,
        });

        placeSearch.search(keyword, (status: string, result: any) => {
            if (status === 'complete' && result.poiList?.pois?.length) {
                const pois: PoiItem[] = result.poiList.pois.map((poi: any) => ({
                    name: poi.name,
                    address: poi.address,
                    location: { lng: poi.location.lng, lat: poi.location.lat },
                }));
                setSearchResults(pois);

                pois.forEach(poi => {
                    addMarker(poi.location.lng, poi.location.lat, poi.name);
                });

                // Fit bounds to show all markers
                if (pois.length > 0) {
                    mapRef.current.setFitView(markersRef.current);
                }
            } else {
                message.info('未找到相关结果');
                setSearchResults([]);
            }
        });
    };

    const handleLocate = () => {
        const AMap = AMapRef.current;
        if (!AMap || !mapRef.current) return;

        const geolocation = new AMap.Geolocation({
            enableHighAccuracy: true,
            timeout: 10000,
        });

        geolocation.getCurrentPosition((status: string, result: any) => {
            if (status === 'complete') {
                mapRef.current.setCenter([result.position.lng, result.position.lat]);
                clearMarkers();
                addMarker(result.position.lng, result.position.lat, '当前位置');
                message.success('定位成功');
            } else {
                message.error('定位失败，请检查浏览器权限');
            }
        });
    };

    const handleGoToCity = () => {
        if (!mapRef.current || !center.trim()) return;
        const AMap = AMapRef.current;
        if (!AMap) return;

        const geocoder = new AMap.Geocoder();
        geocoder.getLocation(center, (status: string, result: any) => {
            if (status === 'complete' && result.geocodes?.length) {
                const loc = result.geocodes[0].location;
                mapRef.current.setCenter([loc.lng, loc.lat]);
                mapRef.current.setZoom(12);
            } else {
                message.info('未找到该城市');
            }
        });
    };

    return (
        <div>
            <Typography.Title level={3} style={{ marginBottom: 16 }}>高德地图</Typography.Title>
            <Card style={{ marginBottom: 16 }}>
                <Space wrap size="middle">
                    <Search
                        placeholder="搜索地点..."
                        onSearch={handleSearch}
                        enterButton={<Button type="primary" icon={<SearchOutlined />}>搜索</Button>}
                        style={{ width: 300 }}
                        allowClear
                    />
                    <Button icon={<AimOutlined />} onClick={handleLocate}>我的位置</Button>
                    <Input
                        placeholder="输入城市名"
                        value={center}
                        onChange={e => setCenter(e.target.value)}
                        onPressEnter={handleGoToCity}
                        style={{ width: 120 }}
                    />
                    <Button onClick={handleGoToCity}>前往</Button>
                    <Segmented
                        value={mode}
                        onChange={(v) => switchMapStyle(v as MapMode)}
                        options={[
                            { label: '标准', value: 'standard' },
                            { label: '卫星', value: 'satellite' },
                            { label: '暗色', value: 'dark' },
                        ]}
                    />
                </Space>
            </Card>

            {searchResults.length > 0 && (
                <Card
                    title={`搜索结果（${searchResults.length} 条）`}
                    style={{ marginBottom: 16 }}
                    size="small"
                >
                    <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                        {searchResults.map((poi, idx) => (
                            <div
                                key={idx}
                                style={{
                                    padding: '6px 8px',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid #f0f0f0',
                                }}
                                onClick={() => {
                                    mapRef.current?.setCenter([poi.location.lng, poi.location.lat]);
                                    mapRef.current?.setZoom(16);
                                }}
                            >
                                <Typography.Text strong>{poi.name}</Typography.Text>
                                <br />
                                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                    <EnvironmentOutlined /> {poi.address}
                                </Typography.Text>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            <Card bodyStyle={{ padding: 0, overflow: 'hidden' }}>
                <div ref={containerRef} style={{ width: '100%', height: '70vh' }} />
            </Card>
        </div>
    );
}
