import { Link } from 'react-router';
import { Typography } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import projects from '@content/projects';
import PageContainer from '../../../component/blog/PageContainer';
import BlogTag from '../../../component/blog/BlogTag';
import './projects.css';

interface Project {
    name: string;
    description: string;
    tags: string[];
    language?: string;
    url?: string;
    internalPath?: string;
}

export default function Projects() {
    return (
        <PageContainer>
            <header className="projects-header">
                <Typography.Title level={2} className="projects-title">项目作品</Typography.Title>
                <Typography.Text type="secondary" className="projects-subtitle">
                    个人项目与开源贡献，点击进入查看
                </Typography.Text>
            </header>

            <ul className="projects-list">
                {projects.map((project: Project) => {
                    const inner = (
                        <>
                            <div className="project-row-head">
                                <span className="project-row-name">{project.name}</span>
                                {project.language && (
                                    <span className="project-row-lang">{project.language}</span>
                                )}
                                <ArrowRightOutlined className="project-row-arrow" />
                            </div>
                            {project.description && (
                                <p className="project-row-desc">{project.description}</p>
                            )}
                            {project.tags.length > 0 && (
                                <div className="project-row-tags">
                                    {project.tags.map(tag => (
                                        <BlogTag key={tag} tag={tag} size="small" />
                                    ))}
                                </div>
                            )}
                        </>
                    );

                    return (
                        <li key={project.name}>
                            {project.internalPath ? (
                                <Link to={project.internalPath} className="project-row">
                                    {inner}
                                </Link>
                            ) : project.url ? (
                                <a
                                    href={project.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="project-row"
                                >
                                    {inner}
                                </a>
                            ) : (
                                <div className="project-row project-row-static">{inner}</div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </PageContainer>
    );
}
