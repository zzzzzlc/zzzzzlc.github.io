import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Card, Typography, Upload, Button, Space, message, Switch } from 'antd';
import { UploadOutlined, ReloadOutlined } from '@ant-design/icons';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

export default function ThreeViewer() {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const modelRef = useRef<THREE.Object3D | null>(null);
    const frameId = useRef<number>(0);
    const [autoRotate, setAutoRotate] = useState(true);
    const [wireframe, setWireframe] = useState(false);
    const [loading, setLoading] = useState(false);

    const addDefaultModel = (scene: THREE.Scene) => {
        const group = new THREE.Group();

        // Torus knot
        const geometry = new THREE.TorusKnotGeometry(1, 0.35, 128, 32);
        const material = new THREE.MeshStandardMaterial({
            color: 0x6c63ff,
            metalness: 0.3,
            roughness: 0.4,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = 1.5;
        mesh.castShadow = true;
        group.add(mesh);

        // Floor
        const floorGeo = new THREE.PlaneGeometry(20, 20);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x222244, roughness: 0.8 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        group.add(floor);

        scene.add(group);
        modelRef.current = group;
    };

    const initScene = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;

        // Cleanup previous
        if (rendererRef.current) {
            container.removeChild(rendererRef.current.domElement);
            rendererRef.current.dispose();
        }
        cancelAnimationFrame(frameId.current);

        const width = container.clientWidth;
        const height = container.clientHeight;

        // Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a2e);
        sceneRef.current = scene;

        // Camera
        const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
        camera.position.set(3, 2, 5);
        cameraRef.current = camera;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 1.5;
        controlsRef.current = controls;

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(5, 8, 5);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.set(1024, 1024);
        scene.add(dirLight);

        const fillLight = new THREE.DirectionalLight(0x6688cc, 0.4);
        fillLight.position.set(-3, 2, -5);
        scene.add(fillLight);

        // Grid
        const grid = new THREE.GridHelper(20, 40, 0x444466, 0x333355);
        scene.add(grid);

        // Default model: a simple shape
        addDefaultModel(scene);

        // Animation loop
        const animate = () => {
            frameId.current = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        // Resize handler
        const handleResize = () => {
            const w = container.clientWidth;
            const h = container.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(frameId.current);
        };
    }, []);

    useEffect(() => {
        const cleanup = initScene();
        return () => cleanup?.();
    }, [initScene]);

    const removeCurrentModel = () => {
        if (modelRef.current && sceneRef.current) {
            sceneRef.current.remove(modelRef.current);
            modelRef.current.traverse(child => {
                if ((child as THREE.Mesh).geometry) {
                    (child as THREE.Mesh).geometry.dispose();
                }
                if ((child as THREE.Mesh).material) {
                    const mat = (child as THREE.Mesh).material;
                    if (Array.isArray(mat)) mat.forEach(m => m.dispose());
                    else mat.dispose();
                }
            });
            modelRef.current = null;
        }
    };

    const fitCameraToModel = (object: THREE.Object3D) => {
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 2;

        if (cameraRef.current && controlsRef.current) {
            cameraRef.current.position.set(center.x + distance * 0.5, center.y + distance * 0.5, center.z + distance);
            controlsRef.current.target.copy(center);
            controlsRef.current.update();
        }
    };

    const handleFile = (file: File) => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        const reader = new FileReader();

        setLoading(true);

        reader.onload = (e) => {
            const result = e.target?.result;
            if (!result) { setLoading(false); return; }

            removeCurrentModel();

            const onLoad = (object: THREE.Object3D) => {
                object.traverse(child => {
                    if ((child as THREE.Mesh).isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                if (!wireframe) {
                    // Ensure materials exist for STL/OBJ
                    object.traverse(child => {
                        const mesh = child as THREE.Mesh;
                        if (mesh.isMesh && (!mesh.material || (mesh.material as THREE.MeshBasicMaterial).color?.getHex() === 0xffffff)) {
                            mesh.material = new THREE.MeshStandardMaterial({
                                color: 0x6c63ff,
                                metalness: 0.3,
                                roughness: 0.5,
                            });
                        }
                    });
                }

                sceneRef.current?.add(object);
                modelRef.current = object;
                fitCameraToModel(object);
                setLoading(false);
                message.success(`模型 ${file.name} 加载成功`);
            };

            const onError = (err: unknown) => {
                setLoading(false);
                message.error('模型加载失败，请检查文件格式');
                console.error(err);
            };

            try {
                if (ext === 'gltf' || ext === 'glb') {
                    const loader = new GLTFLoader();
                    loader.parse(result, '', (gltf) => {
                        onLoad(gltf.scene);
                    }, onError);
                } else if (ext === 'obj') {
                    const loader = new OBJLoader();
                    const text = typeof result === 'string' ? result : new TextDecoder().decode(result as ArrayBuffer);
                    const object = loader.parse(text);
                    onLoad(object);
                } else if (ext === 'stl') {
                    const loader = new STLLoader();
                    const geometry = loader.parse(result as ArrayBuffer);
                    const material = new THREE.MeshStandardMaterial({ color: 0x6c63ff, metalness: 0.3, roughness: 0.5 });
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    onLoad(mesh);
                } else {
                    setLoading(false);
                    message.error('不支持的格式，请使用 GLB/GLTF/OBJ/STL 文件');
                }
            } catch (err) {
                onError(err);
            }
        };

        if (ext === 'obj') {
            reader.readAsText(file);
        } else {
            reader.readAsArrayBuffer(file);
        }

        return false; // prevent Upload default behavior
    };

    const handleReset = () => {
        removeCurrentModel();
        if (sceneRef.current) {
            addDefaultModel(sceneRef.current);
            cameraRef.current?.position.set(3, 2, 5);
            controlsRef.current?.target.set(0, 0, 0);
            controlsRef.current?.update();
        }
    };

    const handleWireframeChange = (checked: boolean) => {
        setWireframe(checked);
        if (modelRef.current) {
            modelRef.current.traverse(child => {
                const mesh = child as THREE.Mesh;
                if (mesh.isMesh && mesh.material) {
                    const mat = mesh.material as THREE.MeshStandardMaterial;
                    if (mat.isMeshStandardMaterial) {
                        mat.wireframe = checked;
                    }
                }
            });
        }
    };

    const handleAutoRotateChange = (checked: boolean) => {
        setAutoRotate(checked);
        if (controlsRef.current) {
            controlsRef.current.autoRotate = checked;
        }
    };

    return (
        <div>
            <Typography.Title level={3} style={{ marginBottom: 16 }}>3D 模型查看器</Typography.Title>
            <Card style={{ marginBottom: 16 }}>
                <Space wrap size="middle">
                    <Upload
                        accept=".glb,.gltf,.obj,.stl"
                        showUploadList={false}
                        beforeUpload={handleFile}
                    >
                        <Button type="primary" icon={<UploadOutlined />} loading={loading}>
                            上传模型
                        </Button>
                    </Upload>
                    <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
                    <Space>
                        <Typography.Text>自动旋转</Typography.Text>
                        <Switch checked={autoRotate} onChange={handleAutoRotateChange} />
                    </Space>
                    <Space>
                        <Typography.Text>线框模式</Typography.Text>
                        <Switch checked={wireframe} onChange={handleWireframeChange} />
                    </Space>
                </Space>
            </Card>
            <Card bodyStyle={{ padding: 0, overflow: 'hidden' }}>
                <div
                    ref={containerRef}
                    style={{ width: '100%', height: '75vh' }}
                />
            </Card>
        </div>
    );
}
