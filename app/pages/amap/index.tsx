import 'maplibre-gl/dist/maplibre-gl.css';
import { Typography } from 'antd';
import { useAmap } from './hooks/useAmap';
import { ToolbarPanel } from './components/ToolbarPanel';
import { EndpointSearch } from './components/EndpointSearch';
import { SearchResultList } from './components/SearchResultList';
import { RouteResultPanel } from './components/RouteResultPanel';
import { MapStage } from './components/MapStage';

export default function WebGisPage() {
    const controller = useAmap();

    return (
        <div>
            <Typography.Title level={3} style={{ marginBottom: 8 }}>地图导航 · WebGIS</Typography.Title>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                底图：OpenStreetMap · 地理编码：Nominatim · 路由：OSRM（开源，无需 Key）
            </Typography.Text>

            <ToolbarPanel controller={controller} />
            <EndpointSearch controller={controller} />
            <SearchResultList controller={controller} />
            <RouteResultPanel controller={controller} />
            <MapStage controller={controller} />
        </div>
    );
}
