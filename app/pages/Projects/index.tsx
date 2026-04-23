import React from 'react';
import { Row, Col, Card, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router';
import projects from '@content/projects';

export default function Projects() {
    const navigate = useNavigate();

    return (
        <div>
            <Typography.Title level={3} style={{ marginBottom: 24 }}>项目作品</Typography.Title>
            <Row gutter={[16, 16]}>
                {projects.map(project => {
                    const linkEl = project.internalPath
                        ? <Typography.Link onClick={() => navigate(project.internalPath!)}>打开</Typography.Link>
                        : project.url
                            ? <Typography.Link href={project.url} target="_blank">查看</Typography.Link>
                            : null;

                    return (
                        <Col xs={24} sm={12} md={8} key={project.name}>
                            <Card
                                hoverable
                                title={project.name}
                                extra={linkEl}
                                style={{ height: '100%' }}
                            >
                                <Typography.Paragraph>{project.description}</Typography.Paragraph>
                                <div>
                                    {project.tags.map(tag => (
                                        <Tag key={tag}>{tag}</Tag>
                                    ))}
                                    {project.language && (
                                        <Tag color="blue">{project.language}</Tag>
                                    )}
                                </div>
                            </Card>
                        </Col>
                    );
                })}
            </Row>
        </div>
    );
}
