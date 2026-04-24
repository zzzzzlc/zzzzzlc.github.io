---
title: "文件预览解决方案"
date: "2026-04-23"
tags:
  - 文件预览
  - PDF
  - Office
  - 前端工程化
category: "前端进阶"
summary: "全面梳理前端文件预览技术方案，涵盖 PDF、Word、Excel、PPT、图片、音视频等主流文档类型的预览实现方式与最佳实践。"
---
# 文件预览解决方案

在日常业务系统中，文件预览是最常见的需求之一。用户上传或接收到文件后，往往需要在线预览而非下载查看。本文将系统梳理前端各类文档的预览方案，涵盖 PDF、Word、Excel、PPT、图片和音视频等主流格式。

## 一、PDF 预览

PDF 是文档预览中最基础也最成熟的场景。

### 1.1 PDF.js

Mozilla 出品的开源 PDF 渲染引擎，是目前最主流的纯前端 PDF 预览方案。

```bash
npm install pdfjs-dist
```

```typescript
import * as pdfjsLib from 'pdfjs-dist';

// 设置 Worker 路径
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

async function renderPDF(url: string, container: HTMLElement) {
  const pdf = await pdfjsLib.getDocument(url).promise;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    container.appendChild(canvas);
    await page.render({ canvasContext: context, viewport }).promise;
  }
}
```

**优点：**

- 纯前端渲染，无需后端支持
- 支持文本选择、搜索、缩放
- 社区活跃，生态完善

**缺点：**

- 大文件渲染较慢，内存占用高
- 复杂排版（表格、表单）可能存在偏差

### 1.2 React-PDF

基于 PDF.js 封装的 React 组件，开箱即用。

```bash
npm install react-pdf
```

```tsx
import { Document, Page } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

function PDFViewer({ url }: { url: string }) {
  const [numPages, setNumPages] = useState<number>(0);

  return (
    <Document
      file={url}
      onLoadSuccess={({ numPages }) => setNumPages(numPages)}
    >
      {Array.from({ length: numPages }, (_, i) => (
        <Page key={i + 1} pageNumber={i + 1} width={800} />
      ))}
    </Document>
  );
}
```

### 1.3 iframe / embed 原生方案

浏览器原生支持 PDF 嵌入，最简单但可控性最低。

```tsx
// 方式一：iframe
<iframe src="/files/demo.pdf" width="100%" height="600px" />

// 方式二：embed
<embed src="/files/demo.pdf" type="application/pdf" width="100%" height="600px" />

// 方式三：object
<object data="/files/demo.pdf" type="application/pdf" width="100%" height="600px" />
```

> 注意：移动端浏览器通常不支持内嵌 PDF 预览，会直接触发下载。

## 二、Word 文档预览（.doc / .docx）

Word 文档预览是前端最复杂的场景之一，主要有以下方案。

### 2.1 mammoth.js —— Word 转 HTML

mammoth.js 将 `.docx` 文件转换为 HTML，适合以阅读为主的场景。

```bash
npm install mammoth
```

```typescript
import mammoth from 'mammoth';

async function previewWord(file: File, container: HTMLElement) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  container.innerHTML = result.value;

  // 也可以获取样式映射
  if (result.messages.length > 0) {
    console.warn('转换警告:', result.messages);
  }
}
```

**自定义样式映射：**

```typescript
const options = {
  styleMap: [
    "p[style-name='Heading 1'] => h1.doc-heading:fresh",
    "p[style-name='Heading 2'] => h2.doc-subheading:fresh",
    "r[style-name='Strong'] => strong",
  ],
  convertImage: mammoth.images.imgElement((image) =>
    image.read('base64').then((data) => ({
      src: `data:${image.contentType};base64,${data}`,
    }))
  ),
};

const result = await mammoth.convertToHtml({ arrayBuffer }, options);
```

**优点：** 轻量、纯前端、转换结果为语义化 HTML
**缺点：** 只支持 `.docx`，不支持 `.doc`；复杂排版丢失较多；不支持分页

### 2.2 docx-preview

专门用于在浏览器中渲染 `.docx` 文件的库，保留更多原始排版。

```bash
npm install docx-preview
```

```typescript
import { renderAsync } from 'docx-preview';

async function previewDocx(file: File, container: HTMLElement) {
  const arrayBuffer = await file.arrayBuffer();
  await renderAsync(arrayBuffer, container, undefined, {
    className: 'docx-wrapper',
    inWrapper: true,       // 页面包装器
    ignoreWidth: false,
    ignoreHeight: false,
    ignoreFonts: false,
    breakPages: true,      // 分页显示
    renderHeaders: true,
    renderFooters: true,
    renderFootnotes: true,
  });
}
```

**优点：** 排版还原度较高，支持分页、页眉页脚
**缺点：** 包体积较大，复杂表格和图片可能存在偏差

### 2.3 服务端转换方案

对于排版还原度要求高的场景，推荐服务端转换。

**LibreOffice Headless 模式：**

```bash
# 将 Word 转为 PDF
libreoffice --headless --convert-to pdf input.docx --outdir /output
```

**Node.js 中调用：**

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function convertToPdf(inputPath: string, outputDir: string) {
  await execAsync(`libreoffice --headless --convert-to pdf "${inputPath}" --outdir "${outputDir}"`);
  return inputPath.replace(/\.docx?$/, '.pdf').replace(/.*\//, `${outputDir}/`);
}
```

**KKFileView（开源文档预览服务）：**

```yaml
# docker-compose.yml
version: '3'
services:
  kkfileview:
    image: keking/kkfileview:4.4.0
    ports:
      - "8012:8012"
    environment:
      - KK_OFFICE_PREVIEW_TYPE=image  # image 或 pdf
```

使用方式：

```typescript
const previewUrl = `http://your-server:8012/onlinePreview?url=${encodeURIComponent(fileUrl)}`;
window.open(previewUrl);
```

## 三、Excel 表格预览（.xls / .xlsx）

### 3.1 SheetJS（xlsx）

功能最强大的纯前端 Excel 解析库。

```bash
npm install xlsx
```

```typescript
import * as XLSX from 'xlsx';

async function previewExcel(file: File, container: HTMLElement) {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  // 获取第一个 Sheet
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // 转为 HTML 表格
  const html = XLSX.utils.sheet_to_html(worksheet, {
    editable: false,
    id: 'excel-table',
  });
  container.innerHTML = html;
}
```

**高级用法 —— 自定义渲染：**

```typescript
function renderExcelToGrid(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  // 转为 JSON 数组
  const data: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet);

  // 获取范围
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

  // 动态生成列定义
  const columns = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const header = sheet[XLSX.utils.encode_cell({ r: range.s.r, c })];
    columns.push({
      title: header?.v || `列${c + 1}`,
      dataIndex: XLSX.utils.encode_col(c),
      key: XLSX.utils.encode_col(c),
    });
  }

  return { columns, data };
}
```

### 3.2 LuckySheet / Univer

功能完整的在线电子表格方案，支持公式、图表等高级特性。

```bash
# Univer（LuckySheet 的升级版）
npm install @univerjs/core @univerjs/design @univerjs/sheets
```

```typescript
import { Univer, UniverInstanceType } from '@univerjs/core';
import { defaultTheme } from '@univerjs/design';
import { UniverSheetsPlugin } from '@univerjs/sheets';

const univer = new Univer({
  theme: defaultTheme,
  locale: 'zh-CN',
});

univer.registerPlugin(UniverSheetsPlugin);

univer.createUnit(UniverInstanceType.UNIVER_SHEET, {
  sheetOrder: ['sheet-01'],
  sheets: {
    'sheet-01': { name: 'Sheet1' },
  },
});
```

**优点：** 完整的表格编辑能力，支持公式、条件格式、图表
**缺点：** 包体积大，学习成本高

### 3.3 Handsontable

轻量级的类 Excel 表格组件，适合预览 + 简单编辑场景。

```bash
npm install handsontable
```

## 四、PPT 演示文稿预览（.ppt / .pptx）

PPT 预览是前端方案中最困难的场景。

### 4.1 pptxjs

纯前端 PPTX 渲染库。

```bash
npm install pptxjs
```

```typescript
import PptxJs from 'pptxjs';

async function previewPptx(fileUrl: string, container: HTMLElement) {
  const pptx = new PptxJs(container);
  pptx.load(fileUrl);

  // 监听渲染完成
  pptx.on('load', () => {
    console.log('PPT 加载完成');
  });
}
```

### 4.2 服务端转换（推荐）

PPT 排版复杂（动画、嵌入对象、特殊字体），纯前端难以完美还原。推荐方案：

**方案一：LibreOffice 转 PDF**

```bash
libreoffice --headless --convert-to pdf input.pptx --outdir /output
```

转换后用 PDF.js 预览。

**方案二：LibreOffice 转图片**

```bash
libreoffice --headless --convert-to pdf input.pptx --outdir /tmp
# 再用 ImageMagick 将 PDF 转为图片
convert -density 150 /tmp/input.pdf -quality 90 /output/slide-%d.png
```

**方案三：ONLYOFFICE**

功能最完整的在线 Office 预览/编辑方案。

```yaml
# docker-compose.yml
version: '3'
services:
  onlyoffice:
    image: onlyoffice/documentserver:8.2
    ports:
      - "8080:80"
    environment:
      - JWT_SECRET=your_secret_key
```

```typescript
// 前端集成
function initOnlyOffice(config: {
  documentUrl: string;
  key: string;
  title: string;
}) {
  new window.DocsAPI.DocEditor('placeholder', {
    document: {
      fileType: 'pptx',
      key: config.key,
      title: config.title,
      url: config.documentUrl,
    },
    editorConfig: {
      mode: 'view',  // 只读预览模式
    },
    documentType: 'slide',
  });
}
```

## 五、图片预览

### 5.1 基础方案

```tsx
function ImageViewer({ src, alt }: { src: string; alt?: string }) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <img
        src={src}
        alt={alt}
        style={{ maxWidth: '100%', height: 'auto' }}
        loading="lazy"
      />
    </div>
  );
}
```

### 5.2 react-image-lightbox / yet-another-react-lightbox

支持缩放、旋转、左右切换的图片预览组件。

```bash
npm install yet-another-react-lightbox
```

```tsx
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';

function Gallery({ images }: { images: { src: string; alt: string }[] }) {
  const [index, setIndex] = useState(-1);

  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {images.map((img, i) => (
          <img
            key={i}
            src={img.src}
            alt={img.alt}
            style={{ width: 120, height: 120, objectFit: 'cover', cursor: 'pointer' }}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
      <Lightbox
        open={index >= 0}
        index={index}
        close={() => setIndex(-1)}
        slides={images.map(img => ({ src: img.src, alt: img.alt }))}
        plugins={[Zoom]}
      />
    </>
  );
}
```

### 5.3 特殊图片格式


| 格式 | 说明           | 方案                                     |
| ---- | -------------- | ---------------------------------------- |
| PSD  | Photoshop 文件 | `psd.js` 纯前端解析                      |
| SVG  | 矢量图         | 直接`<img>` 或 `dangerouslySetInnerHTML` |
| HEIC | 苹果图片       | `heic2any` 转换为 JPEG 后预览            |
| WebP | 新一代图片     | 现代浏览器原生支持                       |
| TIFF | 高质量位图     | `utif.js` 解析渲染                       |

```typescript
// HEIC 转换示例
import heic2any from 'heic2any';

async function previewHeic(file: File): Promise<string> {
  const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
  return URL.createObjectURL(blob as Blob);
}
```

## 六、音视频预览

### 6.1 HTML5 原生方案

```tsx
function VideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <video
      ref={videoRef}
      src={src}
      controls
      preload="metadata"
      style={{ maxWidth: '100%' }}
    >
      您的浏览器不支持视频播放
    </video>
  );
}

function AudioPlayer({ src }: { src: string }) {
  return <audio src={src} controls preload="metadata" />;
}
```

### 6.2 Video.js / DPlayer

功能更强大的播放器组件。

```bash
npm install video.js
```

```typescript
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

function initPlayer(container: HTMLElement, src: string) {
  const player = videojs(container, {
    controls: true,
    autoplay: false,
    preload: 'auto',
    sources: [{ src, type: 'video/mp4' }],
    playbackRates: [0.5, 1, 1.5, 2],
  });

  return () => player.dispose(); // 清理
}
```

### 6.3 流媒体格式支持


| 格式        | 方案           |
| ----------- | -------------- |
| HLS (.m3u8) | `hls.js`       |
| FLV         | `flv.js`       |
| DASH        | `dash.js`      |
| WebRTC      | 浏览器原生 API |

```typescript
// HLS 播放示例
import Hls from 'hls.js';

function playHls(videoElement: HTMLVideoElement, src: string) {
  if (Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(src);
    hls.attachMedia(videoElement);
    return () => hls.destroy();
  } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari 原生支持
    videoElement.src = src;
  }
}
```

## 七、文本与代码预览

### 7.1 纯文本

```typescript
async function previewText(file: File): Promise<string> {
  return file.text();
}
```

### 7.2 Markdown

```bash
npm install marked highlight.js
```

```typescript
import { marked } from 'marked';
import hljs from 'highlight.js';

marked.setOptions({
  highlight(code: string, lang: string) {
    return hljs.highlightAuto(code, lang ? [lang] : undefined).value;
  },
});

function previewMarkdown(content: string): string {
  return marked(content);
}
```

### 7.3 代码文件 —— Monaco Editor

```typescript
import * as monaco from 'monaco-editor';

function previewCode(content: string, language: string, container: HTMLElement) {
  const editor = monaco.editor.create(container, {
    value: content,
    language,
    theme: 'vs-dark',
    readOnly: true,        // 只读预览
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
  });

  return () => editor.dispose();
}
```

## 八、通用预览架构设计

在实际项目中，通常需要统一的文件预览入口。

### 8.1 文件类型识别与路由

```typescript
type PreviewType =
  | 'pdf'
  | 'word'
  | 'excel'
  | 'ppt'
  | 'image'
  | 'video'
  | 'audio'
  | 'text'
  | 'code'
  | 'unsupported';

const MIME_MAP: Record<string, PreviewType> = {
  'application/pdf': 'pdf',
  'application/msword': 'word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
  'application/vnd.ms-excel': 'excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'ppt',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/svg+xml': 'image',
  'video/mp4': 'video',
  'video/webm': 'video',
  'audio/mpeg': 'audio',
  'audio/ogg': 'audio',
  'text/plain': 'text',
  'text/csv': 'text',
  'text/markdown': 'code',
};

function getPreviewType(file: File): PreviewType {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const extMap: Record<string, PreviewType> = {
    pdf: 'pdf', doc: 'word', docx: 'word',
    xls: 'excel', xlsx: 'excel', csv: 'text',
    ppt: 'ppt', pptx: 'ppt',
    jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', svg: 'image',
    mp4: 'video', webm: 'video', avi: 'video', mov: 'video',
    mp3: 'audio', wav: 'audio', ogg: 'audio',
    md: 'code', json: 'code', ts: 'code', tsx: 'code', js: 'code', jsx: 'code',
    css: 'code', html: 'code', py: 'code', java: 'code',
  };
  return extMap[ext || ''] || MIME_MAP[file.type] || 'unsupported';
}
```

### 8.2 统一预览组件

```tsx
interface FilePreviewProps {
  file: File;
  url?: string;
}

export default function FilePreview({ file, url }: FilePreviewProps) {
  const previewType = getPreviewType(file);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    switch (previewType) {
      case 'pdf':
        // 使用 PDF.js 或 react-pdf 渲染
        break;
      case 'word':
        // 使用 mammoth 或 docx-preview 渲染
        break;
      case 'excel':
        // 使用 SheetJS 渲染
        break;
      case 'ppt':
        // 使用 pptxjs 或跳转服务端预览
        break;
      case 'image':
        // 渲染 <img> + lightbox
        break;
      case 'video':
        // 渲染 <video> 播放器
        break;
      case 'audio':
        // 渲染 <audio> 播放器
        break;
      case 'text':
      case 'code':
        // 渲染文本内容或代码编辑器
        break;
      default:
        // 提示不支持预览，提供下载链接
        break;
    }
  }, [file, previewType]);

  if (previewType === 'unsupported') {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <p>该文件类型暂不支持在线预览</p>
        <a href={url || '#'} download={file.name}>下载文件</a>
      </div>
    );
  }

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
```

## 九、方案对比与选型建议


| 文档类型 | 纯前端方案             | 还原度 | 推荐方案                                            |
| -------- | ---------------------- | ------ | --------------------------------------------------- |
| PDF      | PDF.js / react-pdf     | 高     | react-pdf（React 项目）                             |
| Word     | mammoth / docx-preview | 中     | docx-preview（预览） / LibreOffice 转 PDF（高保真） |
| Excel    | SheetJS / Univer       | 中高   | SheetJS（只读） / Univer（需要编辑）                |
| PPT      | pptxjs                 | 低     | LibreOffice 转 PDF / KKFileView / ONLYOFFICE        |
| 图片     | 原生 + lightbox        | 高     | yet-another-react-lightbox                          |
| 视频     | video.js / hls.js      | 高     | video.js + hls.js                                   |
| 音频     | 原生 audio             | 高     | HTML5 audio                                         |
| 代码     | Monaco Editor          | 高     | Monaco Editor（只读模式）                           |

### 选型原则

1. **简单场景**（只要能看）：优先纯前端方案，降低服务端压力
2. **高保真要求**（排版不能差）：服务端转 PDF，前端用 PDF.js 渲染
3. **需要编辑能力**：考虑 ONLYOFFICE 或 Univer 等完整方案
4. **企业级需求**：部署 KKFileView 或 ONLYOFFICE 服务，统一预览入口
5. **移动端适配**：优先服务端转图片方案，兼容性最好

## 十、性能优化

### 10.1 大文件处理

```typescript
// 分片加载 PDF
async function loadPDFChunk(url: string, startPage: number, endPage: number) {
  const pdf = await pdfjsLib.getDocument(url).promise;
  const pages = [];
  for (let i = startPage; i <= Math.min(endPage, pdf.numPages); i++) {
    const page = await pdf.getPage(i);
    pages.push(page);
  }
  return pages;
}

// 虚拟滚动 —— 只渲染可视区域的页面
function useVirtualScroll(totalPages: number, viewportHeight: number) {
  const [visibleRange, setVisibleRange] = useState([1, 10]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    const pageHeight = 800; // 每页高度
    const start = Math.floor(scrollTop / pageHeight) + 1;
    const end = Math.min(start + Math.ceil(viewportHeight / pageHeight) + 2, totalPages);
    setVisibleRange([start, end]);
  }, [totalPages, viewportHeight]);

  return { visibleRange, handleScroll };
}
```

### 10.2 缓存策略

```typescript
// 文件缓存 —— 避免重复请求
const fileCache = new Map<string, ArrayBuffer>();

async function fetchFileWithCache(url: string): Promise<ArrayBuffer> {
  if (fileCache.has(url)) return fileCache.get(url)!;

  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  fileCache.set(url, buffer);
  return buffer;
}
```

### 10.3 Web Worker 处理

```typescript
// worker.ts
self.onmessage = async (e) => {
  const { type, data } = e.data;
  switch (type) {
    case 'parseExcel': {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(data, { type: 'array' });
      self.postMessage({ type: 'excelReady', data: workbook });
      break;
    }
    case 'parseWord': {
      const mammoth = await import('mammoth');
      const result = await mammoth.convertToHtml({ arrayBuffer: data });
      self.postMessage({ type: 'wordReady', data: result.value });
      break;
    }
  }
};
```

## 总结

前端文件预览没有银弹，需要根据具体场景选择合适的方案：

- **PDF** 是最成熟的场景，`react-pdf` 基本能满足所有需求
- **Word / PPT** 排版还原困难，高保真场景推荐服务端转 PDF
- **Excel** 有不错的纯前端方案，`SheetJS` + `Univer` 覆盖大部分场景
- **图片 / 音视频** 浏览器原生支持较好，配合专业组件提升体验
- **企业级应用** 建议部署 `KKFileView` 或 `ONLYOFFICE` 作为统一预览服务

选择方案时，在"纯前端轻量"和"服务端高保真"之间找到平衡点，才是最优解。
