import type { PoiItem, RouteManeuver, RouteProfile, RouteResult, RouteStep } from '../types';
import { buildInstruction } from '../utils/format';
import { NOMINATIM_URL, OSRM_BASE_URL } from '../utils/constants';

/** Nominatim 单条搜索结果（经纬度为字符串，需 parseFloat） */
interface NominatimItem {
    name: string;
    display_name: string;
    lon: string;
    lat: string;
}

/** OSRM 路由单步（最小精确类型，替代原 any） */
interface OsrmStep {
    maneuver: RouteManeuver;
    distance: number;
    duration: number;
    name: string;
}

/** OSRM 路由响应体（最小精确类型，替代原 any） */
interface OsrmRouteResponse {
    code: string;
    routes: Array<{
        distance: number;
        duration: number;
        geometry: { type: 'LineString'; coordinates: [number, number][] };
        legs: Array<{ steps: OsrmStep[] }> | null;
    }> | null;
}

/**
 * 地理编码搜索：Nominatim 免费 OSM 服务
 * 返回空数组表示无结果；网络/解析错误抛出由调用方捕获
 */
export const searchPois = async (keyword: string): Promise<PoiItem[]> => {
    const res = await fetch(
        `${NOMINATIM_URL}?format=json&limit=5&q=${encodeURIComponent(keyword)}`,
        { headers: { 'Accept-Language': 'zh-CN' } },
    );
    const data: NominatimItem[] = await res.json();
    if (!data.length) return [];
    return data.map((item) => ({
        name: item.name || item.display_name.split(',')[0],
        display_name: item.display_name,
        lng: parseFloat(item.lon),
        lat: parseFloat(item.lat),
    }));
};

/**
 * 路线规划：OSRM 公共服务
 * @returns 路线结果；null 表示服务返回非 Ok（无可用路线），由调用方提示
 * @throws 网络/解析错误由调用方捕获
 */
export const planRoute = async (
    start: PoiItem,
    end: PoiItem,
    profile: RouteProfile,
): Promise<RouteResult | null> => {
    const coordStr = `${start.lng},${start.lat};${end.lng},${end.lat}`;
    const url = `${OSRM_BASE_URL}/${profile}/${coordStr}?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url);
    const data: OsrmRouteResponse = await res.json();

    if (data.code !== 'Ok' || !data.routes?.length) return null;

    const r = data.routes[0];
    const steps: RouteStep[] = (r.legs?.[0]?.steps ?? []).map((s) => ({
        instruction: buildInstruction(s.maneuver),
        distance: s.distance,
        duration: s.duration,
        name: s.name,
    }));

    return {
        distance: r.distance,
        duration: r.duration,
        geometry: r.geometry,
        steps,
    };
};
