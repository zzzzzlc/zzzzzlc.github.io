---
title: "Nginx"
date: "2026-04-22"
tags: ["Nginx", "服务器", "性能优化", "运维"]
category: "技术"
summary: "全面介绍 Nginx 核心配置、虚拟主机、反向代理、负载均衡、HTTPS、缓存策略、安全加固与性能调优，帮助构建稳定高效的 Web 服务。"
---
# Nginx

Nginx 是目前使用最广泛的 Web 服务器和反向代理，超过 30% 的网站在使用它。本文将系统介绍 Nginx 的核心配置与优化策略。

## 一、Nginx 核心架构

### 1. 进程模型

```
Master Process（主进程）
├── Worker Process 1    ← 处理请求
├── Worker Process 2    ← 处理请求
├── Worker Process 3    ← 处理请求
└── Worker Process N    ← 处理请求

Cache Manager           ← 管理缓存索引
Cache Loader            ← 加载缓存到内存
```

- **Master**：管理 Worker 进程、读取配置、平滑重启
- **Worker**：处理实际请求，基于事件驱动（epoll/kqueue）
- 单个 Worker 可处理数万并发连接

### 2. 配置文件结构

```nginx
# /etc/nginx/nginx.conf

user nginx;
worker_processes auto;          # Worker 数量，auto = CPU 核心数
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;    # 每个 Worker 的最大连接数
    use epoll;                  # Linux 使用 epoll
}

http {
    include       mime.types;
    default_type  application/octet-stream;

    # 日志格式
    log_format main '$remote_addr - $remote_user [$time_local] '
                    '"$request" $status $body_bytes_sent '
                    '"$http_referer" "$http_user_agent"';

    access_log /var/log/nginx/access.log main;

    # 全局性能参数
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;

    # Gzip 压缩
    gzip on;

    # 包含虚拟主机配置
    include /etc/nginx/conf.d/*.conf;
}
```

## 二、虚拟主机配置

### 1. 静态网站（前端 SPA）

```nginx
server {
    listen 80;
    server_name www.example.com example.com;

    root /var/www/html;
    index index.html;

    # SPA 路由回退
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源长缓存（文件名含 hash）
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # 禁止访问隐藏文件
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    # 自定义 404
    error_page 404 /index.html;
}
```

### 2. 多站点共存

```nginx
# 站点 A
server {
    listen 80;
    server_name site-a.com;
    root /var/www/site-a;
    # ...
}

# 站点 B
server {
    listen 80;
    server_name site-b.com;
    root /var/www/site-b;
    # ...
}
```

### 3. HTTP 强制跳转 HTTPS

```nginx
server {
    listen 80;
    server_name example.com www.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com www.example.com;
    # ... SSL 和站点配置
}
```

## 三、反向代理与负载均衡

### 1. 反向代理基础

```nginx
server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket 代理
    location /ws/ {
        proxy_pass http://127.0.0.1:3000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;     # WebSocket 长连接超时
    }
}
```

### 2. 负载均衡

```nginx
# 定义上游服务器组
upstream backend {
    # 轮询（默认）
    server 192.168.1.10:3000;
    server 192.168.1.11:3000;
    server 192.168.1.12:3000;

    # 健康检查（Nginx Plus / 开源模块）
    # server 192.168.1.10:3000 max_fails=3 fail_timeout=30s;
}

# 加权轮询
upstream backend-weighted {
    server 192.168.1.10:3000 weight=5;   # 5/8 的流量
    server 192.168.1.11:3000 weight=2;   # 2/8 的流量
    server 192.168.1.12:3000 weight=1;   # 1/8 的流量
}

# IP Hash（会话保持）
upstream backend-iphash {
    ip_hash;
    server 192.168.1.10:3000;
    server 192.168.1.11:3000;
}

# 最少连接
upstream backend-least {
    least_conn;
    server 192.168.1.10:3000;
    server 192.168.1.11:3000;
}

server {
    listen 80;
    location / {
        proxy_pass http://backend;
        proxy_next_upstream error timeout http_502 http_503;
    }
}
```

### 3. 前后端分离代理

```nginx
server {
    listen 80;
    server_name www.example.com;

    # 前端静态资源
    location / {
        root /var/www/html;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://backend:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 上传文件大小限制
    client_max_body_size 10m;
}
```

## 四、HTTPS 配置

### 1. SSL 证书配置

```nginx
server {
    listen 443 ssl http2;
    server_name example.com;

    # 证书路径
    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # SSL 协议与加密套件
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;

    # SSL 会话缓存（减少重复握手）
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;

    # OCSP Stapling（加速证书验证）
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;

    # HSTS（强制 HTTPS）
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    root /var/www/html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 2. 使用 Certbot 自动证书

```bash
# 安装 certbot
apt install certbot python3-certbot-nginx

# 自动获取并配置证书
certbot --nginx -d example.com -d www.example.com

# 自动续期（certbot 已自动添加 cron）
certbot renew --dry-run
```

## 五、缓存策略

### 1. 浏览器缓存

```nginx
server {
    # HTML 文件 — 不缓存或短缓存（入口文件变化频繁）
    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
    }

    # 带 hash 的静态资源 — 强缓存一年
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # 图片 — 缓存 30 天
    location ~* \.(jpg|jpeg|png|gif|ico|svg|webp)$ {
        expires 30d;
        add_header Cache-Control "public";
        access_log off;
    }

    # 字体 — 缓存 1 年
    location ~* \.(woff|woff2|ttf|otf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
}
```

### 2. 代理缓存（Nginx 缓存后端响应）

```nginx
# 在 http 块中定义缓存路径
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m
                 max_size=1g inactive=60m use_temp_path=off;

server {
    location /api/ {
        proxy_pass http://backend:3000/;
        proxy_cache api_cache;

        # 缓存条件
        proxy_cache_valid 200 10m;       # 200 响应缓存 10 分钟
        proxy_cache_valid 404 1m;        # 404 缓存 1 分钟
        proxy_cache_methods GET HEAD;

        # 缓存 key
        proxy_cache_key "$scheme$request_method$host$request_uri";

        # 命中状态头（调试用）
        add_header X-Cache-Status $upstream_cache_status;

        # 被多个请求同时miss时，只放行一个去请求后端
        proxy_cache_lock on;
        proxy_cache_lock_timeout 5s;

        # 后端故障时返回过期缓存
        proxy_cache_use_stale error timeout updating http_500 http_502 http_503;
    }
}
```

## 六、Gzip 与 Brotli 压缩

### 1. Gzip 配置

```nginx
http {
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;             # 压缩级别 1-9，6 是性价比之选
    gzip_min_length 1024;          # 小于 1KB 不压缩
    gzip_buffers 16 8k;
    gzip_http_version 1.1;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml
        application/rss+xml
        image/svg+xml
        font/woff2;
}
```

### 2. Brotli（更高效的压缩）

```nginx
# 需要安装 ngx_brotli 模块
http {
    brotli on;
    brotli_comp_level 6;
    brotli_types text/plain text/css application/javascript application/json image/svg+xml;
}
```

**压缩效果对比：**


| 算法   | JS 文件压缩率 | CSS 文件压缩率 |
| ------ | ------------- | -------------- |
| 原始   | 100%          | 100%           |
| Gzip   | ~33%          | ~30%           |
| Brotli | ~28%          | ~25%           |

## 七、安全加固

### 1. 安全响应头

```nginx
server {
    # 防止点击劫持
    add_header X-Frame-Options "SAMEORIGIN" always;

    # 防止 MIME 嗅探
    add_header X-Content-Type-Options "nosniff" always;

    # XSS 防护
    add_header X-XSS-Protection "1; mode=block" always;

    # Referrer 策略
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # 内容安全策略（CSP）
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self';" always;

    # 权限策略
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
}
```

### 2. 访问控制

```nginx
# IP 黑白名单
location /admin/ {
    allow 192.168.1.0/24;   # 允许内网
    allow 10.0.0.1;          # 允许特定 IP
    deny all;                # 拒绝其他
    proxy_pass http://backend:3000;
}

# 基础认证
location /private/ {
    auth_basic "Restricted Area";
    auth_basic_user_file /etc/nginx/.htpasswd;
    root /var/www/html;
}

# 生成密码文件
# htpasswd -c /etc/nginx/.htpasswd admin
```

### 3. 限流防刷

```nginx
# 在 http 块中定义限流区域
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;

server {
    # API 限流：每秒 30 次，突发允许 10 次
    location /api/ {
        limit_req zone=api_limit burst=10 nodelay;
        proxy_pass http://backend:3000;
    }

    # 登录接口更严格：每分钟 5 次
    location /api/login {
        limit_req zone=login_limit burst=3 nodelay;
        proxy_pass http://backend:3000;
    }

    # 并发连接限制
    limit_conn_zone $binary_remote_addr zone=conn_limit:10m;
    limit_conn conn_limit 50;   # 每个 IP 最多 50 个并发连接
}
```

### 4. 防止恶意请求

```nginx
server {
    # 禁止常见恶意 User-Agent
    if ($http_user_agent ~* (sqlmap|nikto|nmap|masscan|dirbuster)) {
        return 403;
    }

    # 禁止特定 HTTP 方法
    if ($request_method !~ ^(GET|HEAD|POST|PUT|DELETE|OPTIONS)$ ) {
        return 405;
    }

    # 限制请求体大小
    client_max_body_size 10m;
    client_body_buffer_size 128k;

    # 限制 URL 长度
    large_client_header_buffers 4 8k;
}
```

## 八、性能调优

### 1. 连接与进程优化

```nginx
# nginx.conf
user nginx;
worker_processes auto;                    # 自动匹配 CPU 核心数
worker_cpu_affinity auto;                 # CPU 亲和性
worker_rlimit_nofile 65535;               # Worker 最大文件描述符数

events {
    worker_connections 4096;              # 每个 Worker 最大连接数
    use epoll;
    multi_accept on;                      # 一次接受所有新连接
    accept_mutex off;                     # 关闭互斥锁（高并发场景）
}
```

### 2. 静态文件优化

```nginx
http {
    sendfile on;              # 零拷贝传输文件
    tcp_nopush on;            # 优化数据包发送
    tcp_nodelay on;           # 禁用 Nagle 算法（低延迟）
    keepalive_timeout 65;

    # 减少磁盘 I/O
    open_file_cache max=10000 inactive=20s;
    open_file_cache_valid 30s;
    open_file_cache_min_uses 2;
    open_file_cache_errors on;

    # 输出缓冲
    output_buffers 1 32k;
    postpone_output 1460;
}
```

### 3. 日志优化

```nginx
http {
    # 关闭不需要记录的请求（静态资源、健康检查）
    map $uri $loggable {
        /health 0;
        /favicon.ico 0;
        /robots.txt 0;
        default 1;
    }

    access_log /var/log/nginx/access.log main if=$loggable;

    # 或完全关闭访问日志（高流量场景）
    # access_log off;
}
```

## 九、监控与调试

### 1. 状态页面

```nginx
location /nginx_status {
    stub_status on;
    access_log off;
    allow 127.0.0.1;
    deny all;
}
```

访问 `/nginx_status` 返回：

```
Active connections: 10
server accepts handled requests
 100 100 200
Reading: 0 Writing: 1 Waiting: 9
```

- **Active connections**：当前活跃连接数
- **Waiting**：等待请求的 keep-alive 连接数

### 2. 常用调试命令

```bash
# 测试配置语法
nginx -t

# 平滑重启（不中断服务）
nginx -s reload

# 查看 Nginx 进程
ps aux | grep nginx

# 实时监控日志
tail -f /var/log/nginx/access.log

# 统计访问量 Top 10 IP
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -10

# 统计状态码分布
awk '{print $9}' access.log | sort | uniq -c | sort -rn

# 测试压缩是否生效
curl -H "Accept-Encoding: gzip" -I https://example.com
```

## 十、完整生产配置模板

```nginx
user nginx;
worker_processes auto;
worker_rlimit_nofile 65535;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}

http {
    include       mime.types;
    default_type  application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] '
                    '"$request" $status $body_bytes_sent '
                    '"$http_referer" "$http_user_agent" '
                    'rt=$request_time';

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml image/svg+xml;

    # 缓存配置
    open_file_cache max=10000 inactive=20s;
    open_file_cache_valid 30s;

    # 限流
    limit_req_zone $binary_remote_addr zone=general:10m rate=30r/s;

    server {
        listen 80;
        server_name example.com;
        return 301 https://$host$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name example.com;

        ssl_certificate     /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        add_header Strict-Transport-Security "max-age=31536000" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;

        root /var/www/html;
        index index.html;

        location / {
            limit_req zone=general burst=20 nodelay;
            try_files $uri $uri/ /index.html;
        }

        location /assets/ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            access_log off;
        }

        location /api/ {
            proxy_pass http://127.0.0.1:3000/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location ~ /\. { deny all; }
    }
}
```

## 总结

Nginx 配置的核心目标是**稳定、安全、高性能**：

- **稳定**：负载均衡、健康检查、故障转移（`proxy_next_upstream`）、优雅重启
- **安全**：HTTPS、安全响应头、限流防刷、访问控制、恶意请求过滤
- **性能**：Gzip/Brotli 压缩、静态资源缓存、代理缓存、sendfile 零拷贝、连接池优化

掌握这些配置，足以应对绝大多数前端项目的生产部署需求。
