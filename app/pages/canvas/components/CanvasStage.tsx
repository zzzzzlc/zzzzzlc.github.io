import { Card, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { useEffect } from 'react';
import type { CanvasController } from '../types';
import { buildContextMenuItems, handleContextMenuClick } from '../utils/contextMenu';

export interface CanvasStageProps {
    controller: CanvasController;
}

/** 画布舞台：canvas + 右键菜单 + 键盘删除 + 光标坐标（框选/选择框均在 canvas 内绘制） */
export function CanvasStage({ controller }: CanvasStageProps) {
    const {
        canvasRef, tool, cursor, handleDeleteSelected, onContextMenu,
        onMouseDown, onMouseMove, onMouseUp, onMouseLeave,
    } = controller;

    const menuProps: MenuProps = {
        items: buildContextMenuItems(controller),
        onClick: (info) => handleContextMenuClick(info, controller),
    };

    // 键盘删除选中节点（焦点在输入框时跳过，避免误删）
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Delete' && e.key !== 'Backspace') return;
            const tag = (e.target as HTMLElement | null)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            e.preventDefault();
            handleDeleteSelected();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [handleDeleteSelected]);

    return (
        <Card styles={{ body: { padding: 0, overflow: 'hidden', position: 'relative' } }}>
            <Dropdown menu={menuProps} trigger={['contextMenu']}>
                {/* 容器 div 作为 Dropdown 触发器，避免 antd cloneElement 覆盖 canvas 的 ref */}
                <div>
                    <canvas
                        ref={canvasRef}
                        style={{
                            width: '100%',
                            height: '70vh',
                            cursor: tool === 'eraser' ? 'cell' : tool === 'select' ? 'default' : 'crosshair',
                            display: 'block',
                        }}
                        onMouseDown={onMouseDown}
                        onMouseMove={onMouseMove}
                        onMouseUp={onMouseUp}
                        onMouseLeave={onMouseLeave}
                        onContextMenu={onContextMenu}
                    />
                </div>
            </Dropdown>
            {/* 光标坐标显示 */}
            {cursor && (
                <div style={{
                    position: 'absolute',
                    right: 8,
                    bottom: 8,
                    padding: '2px 8px',
                    background: 'rgba(0,0,0,0.6)',
                    color: '#fff',
                    fontSize: 12,
                    borderRadius: 4,
                    pointerEvents: 'none',
                    fontFamily: 'monospace',
                }}>
                    x: {Math.round(cursor.x)}, y: {Math.round(cursor.y)}
                </div>
            )}
        </Card>
    );
}
