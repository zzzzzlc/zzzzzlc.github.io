import { useEffect, useRef } from 'react';
import { createParticleEngine, type ParticleEngine } from './particleField/particleEngine';

/**
 * 首页 3D 粒子背景（壳组件）：
 * 粒子聚合成角色完整形象并保留原色（vertexColors），缓慢摆动、鼠标可排斥，
 * 鼠标冲向视口顶部时触发 wink。three.js 逻辑全部收口在 particleEngine。
 */
export default function ParticleField() {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const engine: ParticleEngine = createParticleEngine(container);
        return () => engine.destroy();
    }, []);

    return <div ref={containerRef} className="particle-field" aria-hidden="true" />;
}
