# 解决 Vite + React 项目“页面空白”排查指南

## 场景与症状

- 本地启动后访问页面为空白，无任何 UI 渲染
- 页面源码能看到 `/<@vite/client>` 或热更新脚本，但没有应用内容
- 浏览器控制台可能无报错，也可能有 404/模块解析错误

## 根因概述

- 入口脚本缺失或未正确引入，React 未挂载到 `#root`
- 使用了无效的 importmap（URL 包含反引号或路径错误），导致依赖解析失败
- `#root` 容器不存在或 `id` 不匹配

## 快速修复

- 在 `index.html` 引入入口脚本：

  ```html
  <script type="module" src="/index.tsx"></script>
  ```

- 确认 `index.tsx` 正确挂载：

  ```ts
  import React from 'react';
  import ReactDOM from 'react-dom/client';
  import App from './App';

  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Missing #root element');
  ReactDOM.createRoot(rootElement).render(<App />);
  ```

- 删除或修正 importmap。此项目使用 Vite 与 npm 依赖，不需要 importmap。

## 这次修改的具体差异

### 删除的代码（index.html 原有 importmap，含无效反引号 URL）

```html
<script type="importmap">
{
  "imports": {
    "@google/genai": " `https://aistudiocdn.com/@google/genai@^1.30.0` ",
    "react-dom/": " `https://aistudiocdn.com/react-dom@^19.2.0/` ",
    "react/": " `https://aistudiocdn.com/react@^19.2.0/` ",
    "react": " `https://aistudiocdn.com/react@^19.2.0` "
  }
}
</script>
```

说明：以上 URL 外层带有反引号字符，浏览器解析为无效地址，导致依赖无法加载。

### 新增的代码（index.html 引入 Vite 入口脚本）

```html
<script type="module" src="/index.tsx"></script>
```

位置参考：`d:\github\Xiangqi\index.html:19`

### 入口挂载代码（index.tsx 保持不变，用于挂载到 #root）

```ts
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

位置参考：`d:\github\Xiangqi\index.tsx:1–15`

## 详细排查清单

- HTML 容器是否存在：`d:\github\Xiangqi\index.html:21–23` 中包含 `<div id="root"></div>`
- 入口脚本是否存在：`d:\github\Xiangqi\index.html:19` 为 `type="module" src="/index.tsx"`
- 入口代码是否挂载：`d:\github\Xiangqi\index.tsx:5–15`
- 浏览器控制台是否报错：检查 404、模块未找到、语法错误
- Vite 是否正常运行：`npm run dev` 输出有本地地址且无报错

## 使用 CDN importmap 的注意事项（如改用纯 CDN 模式）

- URL 必须为有效 ESM 入口，且不带任何反引号或多余字符
- React 19 与 ReactDOM 19.2 可使用 ESM CDN，但当前项目推荐通过 npm + Vite 解析
- `@google/genai@1.30.0` 提供浏览器 ESM 构建，但项目内通过打包使用，无需 importmap

## 预防建议

- 固定入口约定：始终在 `index.html` 中声明 `<script type="module" src="/index.tsx">`
- 不混用两套依赖解析：选择 Vite/npm 或 CDN/importmap 其一；避免并存
- 在 PR/提交前本地运行 `npm run dev` 并检查控制台和页面渲染

## 相关文件位置

- 入口 HTML：`d:\github\Xiangqi\index.html:19`
- React 挂载：`d:\github\Xiangqi\index.tsx:5–15`
- 应用根组件：`d:\github\Xiangqi\App.tsx`

## 常用命令

- 开发：`npm run dev`
- 构建：`npm run build`
- 预览构建产物：`npm run preview`
