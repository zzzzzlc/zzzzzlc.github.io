import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import type { LoadModelResult } from '../types';
import {
    AMBIENT_LIGHT_INTENSITY,
    CAMERA_FAR, CAMERA_FOV, CAMERA_INITIAL_POSITION, CAMERA_NEAR,
    CONTROLS_TARGET,
    DEFAULT_MODEL_METALNESS, DEFAULT_MODEL_ROUGHNESS,
    DIR_LIGHT_INTENSITY,
    FILL_LIGHT_COLOR, FILL_LIGHT_INTENSITY,
    FLOOR_COLOR, FLOOR_ROUGHNESS,
    GRID_MAIN_COLOR, GRID_SUB_COLOR,
    LOADED_MODEL_METALNESS, LOADED_MODEL_ROUGHNESS,
    MODEL_COLOR,
    SCENE_BACKGROUND,
    SHADOW_MAP_SIZE,
} from '../utils/constants';

/**
 * Three.js 引擎句柄：封装场景 / 相机 / 渲染器 / 控制器 / 资源加载与销毁
 * 组件 / hook 不直接 import three.js，统一经由本引擎
 */
export interface ThreeEngine {
    /** 切换自动旋转 */
    setAutoRotate: (enabled: boolean) => void;
    /** 切换线框模式（同步影响当前模型材质） */
    setWireframe: (enabled: boolean) => void;
    /** 加载模型文件（GLB/GLTF/OBJ/STL），返回加载结果供 hook 提示 */
    loadModel: (file: File, wireframe: boolean) => Promise<LoadModelResult>;
    /** 重置为默认模型并复位相机 */
    resetModel: () => void;
    /** 销毁：取消渲染循环 / 移除监听 / 释放渲染器与模型资源 */
    destroy: () => void;
}

/** 取文件后缀（小写） */
const detectFormat = (fileName: string): string | undefined =>
    fileName.split('.').pop()?.toLowerCase();

/** 以文本形式读取文件 */
const readFileAsText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });

/** 以 ArrayBuffer 形式读取文件 */
const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
    });

/**
 * 创建 three.js 场景并装配相机 / 渲染器 / 灯光 / 控制器，返回统一引擎句柄
 * 第三方库实例化、渲染循环与销毁在此收口
 */
export const createThreeEngine = (container: HTMLDivElement): ThreeEngine => {
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SCENE_BACKGROUND);

    // Camera
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, width / height, CAMERA_NEAR, CAMERA_FAR);
    camera.position.set(...CAMERA_INITIAL_POSITION);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    // 限制像素比上限为 2，避免高 DPR（dpr=3）设备渲染 9 倍像素拖垮 GPU
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.5;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, AMBIENT_LIGHT_INTENSITY);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, DIR_LIGHT_INTENSITY);
    dirLight.position.set(5, 8, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(FILL_LIGHT_COLOR, FILL_LIGHT_INTENSITY);
    fillLight.position.set(-3, 2, -5);
    scene.add(fillLight);

    // Grid
    const grid = new THREE.GridHelper(20, 40, GRID_MAIN_COLOR, GRID_SUB_COLOR);
    scene.add(grid);

    let model: THREE.Object3D | null = null;
    let frameId = 0;

    // —— 按需渲染：仅在有变化时才 renderer.render，闲置时停止绘制，GPU 占用降到接近 0 ——
    let needsRender = true;                         // 初值 true 保证首帧渲染
    const invalidate = (): void => { needsRender = true; };
    // 拖拽 / 缩放 / damping 滑行 / autoRotate 旋转都会持续触发 change，自动维持渲染到稳定
    controls.addEventListener('change', invalidate);

    // 默认模型：环面纽结 + 地板
    const addDefaultModel = () => {
        const group = new THREE.Group();

        const geometry = new THREE.TorusKnotGeometry(1, 0.35, 128, 32);
        const material = new THREE.MeshStandardMaterial({
            color: MODEL_COLOR,
            metalness: DEFAULT_MODEL_METALNESS,
            roughness: DEFAULT_MODEL_ROUGHNESS,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = 1.5;
        mesh.castShadow = true;
        group.add(mesh);

        const floorGeo = new THREE.PlaneGeometry(20, 20);
        const floorMat = new THREE.MeshStandardMaterial({ color: FLOOR_COLOR, roughness: FLOOR_ROUGHNESS });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        group.add(floor);

        scene.add(group);
        model = group;
    };

    addDefaultModel();

    // 移除并释放当前模型几何 / 材质资源
    const removeCurrentModel = () => {
        if (!model) return;
        scene.remove(model);
        model.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                const mat = mesh.material;
                if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
                else mat.dispose();
            }
        });
        model = null;
    };

    // 适配相机到模型包围盒
    const fitCameraToModel = (object: THREE.Object3D) => {
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 2;

        camera.position.set(center.x + distance * 0.5, center.y + distance * 0.5, center.z + distance);
        controls.target.copy(center);
        controls.update();
        invalidate();   // 相机 / 目标变化后请求重绘
    };

    // 为 STL/OBJ 等无材质或白色材质网格补默认材质（仅在非线框模式下生效）
    const ensureDefaultMaterial = (object: THREE.Object3D) => {
        object.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            const mat = mesh.material as THREE.MeshBasicMaterial | undefined;
            if (!mat || mat.color?.getHex() === 0xffffff) {
                mesh.material = new THREE.MeshStandardMaterial({
                    color: MODEL_COLOR,
                    metalness: LOADED_MODEL_METALNESS,
                    roughness: LOADED_MODEL_ROUGHNESS,
                });
            }
        });
    };

    // 为加载的网格启用阴影
    const enableShadow = (object: THREE.Object3D) => {
        object.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (mesh.isMesh) {
                mesh.castShadow = true;
                mesh.receiveShadow = true;
            }
        });
    };

    // 渲染循环：每帧推进 damping / autoRotate，但仅脏标记命中时才真正绘制
    const animate = () => {
        frameId = requestAnimationFrame(animate);
        controls.update();
        if (needsRender) {
            renderer.render(scene, camera);
            needsRender = false;
        }
    };
    animate();

    // 自适应尺寸：ResizeObserver 监听容器（覆盖侧栏折叠等 window.resize 捕获不到的场景）
    const handleResize = () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        invalidate();
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return {
        setAutoRotate: (enabled) => {
            controls.autoRotate = enabled;
            invalidate();   // 开启时后续由 change 持续触发；关闭时补一帧定格
        },
        setWireframe: (enabled) => {
            if (!model) return;
            model.traverse((child) => {
                const mesh = child as THREE.Mesh;
                if (mesh.isMesh && mesh.material) {
                    const mat = mesh.material as THREE.MeshStandardMaterial;
                    if (mat.isMeshStandardMaterial) {
                        mat.wireframe = enabled;
                    }
                }
            });
            invalidate();
        },
        loadModel: async (file, wireframe) => {
            const ext = detectFormat(file.name);
            try {
                if (ext === 'gltf' || ext === 'glb') {
                    const buffer = await readFileAsArrayBuffer(file);
                    removeCurrentModel();
                    await new Promise<void>((resolve, reject) => {
                        new GLTFLoader().parse(buffer, '', (gltf) => {
                            const object = gltf.scene;
                            enableShadow(object);
                            if (!wireframe) ensureDefaultMaterial(object);
                            scene.add(object);
                            model = object;
                            fitCameraToModel(object);
                            resolve();
                        }, reject);
                    });
                    return { success: true, message: `模型 ${file.name} 加载成功` };
                }

                if (ext === 'obj') {
                    const text = await readFileAsText(file);
                    removeCurrentModel();
                    const object = new OBJLoader().parse(text);
                    enableShadow(object);
                    if (!wireframe) ensureDefaultMaterial(object);
                    scene.add(object);
                    model = object;
                    fitCameraToModel(object);
                    return { success: true, message: `模型 ${file.name} 加载成功` };
                }

                if (ext === 'stl') {
                    const buffer = await readFileAsArrayBuffer(file);
                    removeCurrentModel();
                    const geometry = new STLLoader().parse(buffer);
                    const material = new THREE.MeshStandardMaterial({
                        color: MODEL_COLOR,
                        metalness: LOADED_MODEL_METALNESS,
                        roughness: LOADED_MODEL_ROUGHNESS,
                    });
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    scene.add(mesh);
                    model = mesh;
                    fitCameraToModel(mesh);
                    return { success: true, message: `模型 ${file.name} 加载成功` };
                }

                return { success: false, message: '不支持的格式，请使用 GLB/GLTF/OBJ/STL 文件' };
            } catch (err) {
                console.error(err);
                return { success: false, message: '模型加载失败，请检查文件格式' };
            }
        },
        resetModel: () => {
            removeCurrentModel();
            addDefaultModel();
            camera.position.set(...CAMERA_INITIAL_POSITION);
            controls.target.set(...CONTROLS_TARGET);
            controls.update();
            invalidate();
        },
        destroy: () => {
            resizeObserver.disconnect();
            controls.removeEventListener('change', invalidate);
            cancelAnimationFrame(frameId);
            removeCurrentModel();
            controls.dispose();
            renderer.dispose();
            renderer.forceContextLoss();   // 主动释放 WebGL 上下文，避免反复进出页面泄漏
            if (renderer.domElement.parentNode === container) {
                container.removeChild(renderer.domElement);
            }
        },
    };
};
