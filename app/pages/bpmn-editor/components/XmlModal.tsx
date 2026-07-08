import { Button, Modal } from 'antd';
import { CopyOutlined, DownloadOutlined } from '@ant-design/icons';
import type { BpmnController } from '../types';

export interface XmlModalProps {
    controller: BpmnController;
}

/** XML 查看弹窗：展示 / 复制 / 下载当前 BPMN XML */
export function XmlModal({ controller }: XmlModalProps) {
    const { xmlModalOpen, currentXml, closeXmlModal, copyXml, downloadCurrentXml } = controller;

    return (
        <Modal
            title="BPMN XML"
            open={xmlModalOpen}
            onCancel={closeXmlModal}
            width={800}
            footer={[
                <Button key="copy" icon={<CopyOutlined />} onClick={copyXml}>
                    复制
                </Button>,
                <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={downloadCurrentXml}>
                    下载
                </Button>,
                <Button key="close" onClick={closeXmlModal}>
                    关闭
                </Button>,
            ]}
        >
            <pre style={{
                background: '#1e1e1e',
                color: '#d4d4d4',
                padding: 16,
                borderRadius: 8,
                maxHeight: '60vh',
                overflow: 'auto',
                fontSize: 12,
                lineHeight: 1.5,
            }}>
                {currentXml}
            </pre>
        </Modal>
    );
}
