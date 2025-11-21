# ♟️ Xiangqi AI Master (中国象棋·大师版)

一个基于 React 和 TypeScript 构建的现代化中国象棋 Web 应用，内置高性能 JavaScript 本地博弈引擎。无需后端服务器，在浏览器中即可体验特级大师水准的对弈。

## ✨ 主要特性 (Features)

*   **🧠 强大的本地 AI 引擎**:
    *   完全运行在浏览器端，无网络延迟。
    *   采用 **0x88 邮箱数组** 进行极速棋盘表示。
    *   实现 **PVS (主变搜索)**、**迭代加深**、**空着裁剪** 和 **静态搜索** 等高级算法。
    *   利用 **Zobrist 哈希** 和 **置换表 (Transposition Table)** 记忆局面，大幅提升算力。
*   **🎮 5 种难度等级**: 从“新手 (Beginner)”到“神级 (Grandmaster)”，满足不同水平玩家的需求。
*   **🎨 拟物化 UI 设计**: 精美的木纹棋盘、具有立体光影的棋子、沉浸式音效（规划中）和流畅的动画。
*   **🛠️ 实用功能**:
    *   **悔棋 (Undo)**: 支持多步撤销，AI 状态同步回滚。
    *   **对局记录 (History)**: 实时显示双方着法记录。
    *   **思考分析**: 展示 AI 的搜索深度、节点数和局面评分。
    *   **多语言支持**: 一键切换中文/英文界面。
    *   **规则辅助**: 自动高亮合法走棋位置，包含“解将”、“飞将”、“困毙”等复杂规则判定。

## 🛠️ 技术栈 (Tech Stack)

*   **前端框架**: [React 19](https://react.dev/)
*   **开发语言**: [TypeScript](https://www.typescriptlang.org/)
*   **样式库**: [Tailwind CSS](https://tailwindcss.com/)
*   **构建工具**: Vite (推荐) 或 Webpack

## 🚀 快速开始 (Getting Started)

### 1. 获取代码
```bash
git clone https://your-repository-url.git
cd xiangqi-ai
```

### 2. 安装依赖
确保您的环境中已安装 Node.js (建议 v16+)。

```bash
npm install
# 或者使用 yarn
yarn install
```

### 3. 启动开发服务器
```bash
npm start
# 或者如果你使用的是 vite
npm run dev
```

打开浏览器访问 `http://localhost:3000` (或终端显示的端口) 即可开始游戏。

## 🧠 AI 引擎原理解析

*   **局面评估**: 结合了子力价值（Material）和位置价值表（PST），并引入了灵活性（Mobility）和老将安全（King Safety）评估。
*   **搜索策略**: 
    *   使用 MVV-LVA（最有价值受害者-攻击者）进行着法排序，优先计算吃子。
    *   杀手启发 (Killer Heuristic) 和 历史启发 (History Heuristic) 优化剪枝效率。
*   **性能优化**: 使用一维数组 (`Int8Array`) 和位运算优化内存访问，避免了 JS 对象创建带来的 GC 压力。

## 📜 游戏规则

1.  **红先黑后**: 玩家执红先行，AI 执黑后行。
2.  **胜利条件**: 困毙对手老将（将死）或对手无棋可走（困毙）。
3.  **特殊规则**:
    *   **将帅照面 (飞将)**: 双方将帅在同一条竖线上且中间无子阻挡时，走棋方直接判负（本游戏在生成走法时会自动规避此情况）。
    *   **长将/长捉**: 即使引擎支持，建议避免无意义的重复循环。

## 🤝 贡献 (Contribution)

欢迎提交 Issue 或 Pull Request 来改进代码！
*   如果你发现 AI 走出了不合规的棋。
*   如果你有更好的 UI 设计建议。
*   如果你想优化评估函数。

## 📄 许可证 (License)

MIT License
