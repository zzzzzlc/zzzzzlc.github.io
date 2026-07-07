/**
 * 全站作者信息常量
 * 单一数据源，被 Header / Footer / About / AuthorBio 等复用
 * 真实信息请按需替换下面的占位值
 */
export const author = {
    name: 'Zeng Lingchao',
    nickname: 'ZLC',
    avatar: '', // 留空时 BlogAvatar 会渲染 monogram；可填本地图片路径或外链 URL
    bio: '前端工程师 / 工程化爱好者 / 写点东西',
    tagline: '写代码，记笔记，分享思考',
    location: 'China',
    social: {
        github: 'https://github.com/zzzzzlc',
        email: 'mailto:zenglingchao@example.com',
        rss: '/rss.xml',
    },
} as const;

export type Author = typeof author;
