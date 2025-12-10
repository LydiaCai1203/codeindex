# CodeIndex

> 🚀 基于 Tree-sitter 的代码索引系统，为 AI 代码智能体提供精准的结构化上下文

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 📖 项目简介

CodeIndex 是一个基于 **Tree-sitter AST** 的跨语言代码索引系统，旨在为代码智能体（Code Bot / Copilot / RAG）提供高置信度的结构化上下文。它不仅提供全文搜索，更重要的是提供**语义结构**——函数、类、方法、调用关系等，让 AI 更精准地理解代码。

## ✨ 核心功能

- 🔍 **结构化索引**：提取函数、方法、类/接口/结构体、变量、属性等符号
- 🔗 **调用链分析**：支持正向/反向调用链生成，深度可配置
- 🤖 **AI 代码摘要**：使用 LLM 自动为每个代码块生成中文注释
- 🔎 **语义搜索**：基于向量嵌入的语义相似度搜索
- 📊 **对象属性分析**：自动提取并索引对象/结构体的属性和方法
- 👀 **实时文件监听**：自动检测文件变更，增量更新索引
- 🌐 **多语言支持**：TypeScript/JavaScript、Go、Python、Rust、Java、HTML

## 🖼️ 效果展示

### 符号查询

![符号查询示例](https://github.com/LydiaCai1203/codeindex/blob/main/simple.jpg)

### 对象属性分析

![对象属性分析示例](https://github.com/LydiaCai1203/codeindex/blob/main/properties.jpg)

### 重复符号查询

![重复符号查询示例](https://github.com/LydiaCai1203/codeindex/blob/main/duplicate.jpg)

## 🛠️ 技术栈

- **语言**：TypeScript (ES2022)
- **AST 解析**：Tree-sitter + 语言特定解析器
- **存储**：SQLite (better-sqlite3, WAL 模式)
- **文件监听**：chokidar
- **CLI 框架**：commander
- **AI 集成**：OpenAI 兼容 API（摘要 + Embeddings）

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
npm run build
```

### 2. 初始化配置

```bash
node dist/cli/index.js init
```

这会生成 `codeindex.config.json` 配置文件，你可以根据需要修改：

```json
{
  "rootDir": ".",
  "dbPath": ".codeindex/sqlite.db",
  "languages": ["ts", "js", "go", "py", "rust", "java", "html"],
  "include": ["src/**/*", "lib/**/*"],
  "exclude": ["**/node_modules/**", "**/dist/**"]
}
```

### 3. 索引项目

```bash
# 使用配置文件（推荐）
node dist/cli/index.js index

# 或使用命令行参数
node dist/cli/index.js index --root . --lang go --include "**/*.go"
```

### 4. 生成 AI 摘要（可选）

在配置文件中填写 `summarizer` 部分的 API 信息：

```json
{
  "summarizer": {
    "apiEndpoint": "https://api.openai.com/v1/chat/completions",
    "apiKey": "your-api-key",
    "model": "gpt-4o-mini"
  }
}
```

然后运行：

```bash
node dist/cli/index.js summarize
```

### 5. 生成向量并启用语义搜索（可选）

在配置文件中填写 `embedding` 部分的 API 信息：

```json
{
  "embedding": {
    "apiEndpoint": "https://api.openai.com/v1/embeddings",
    "apiKey": "your-api-key",
    "model": "text-embedding-3-small",
    "dimension": 1536
  }
}
```

然后运行：

```bash
# 生成向量
node dist/cli/index.js embed

# 语义搜索
node dist/cli/index.js search "用户登录验证" --top-k 5
```

## 📝 常用命令

```bash
# 查询符号
node dist/cli/index.js symbol CreateUser --lang go

# 查看对象属性
node dist/cli/index.js properties UserService --lang go

# 生成调用链
node dist/cli/index.js call-chain --from <symbol_id> --direction forward --depth 5

# 实时文件监听
node dist/cli/index.js watch

# 重建索引
node dist/cli/index.js rebuild
```

## 📚 更多文档

- [快速开始指南](docs/quickstart.md)
- [语言支持说明](docs/language-support.md)
- [摘要功能使用](docs/summarizer-usage.md)
- [项目架构](docs/project.md)

## 🔌 官方 SDK

- [多语言 SDK 目录](sdk/README.md)：汇总 JavaScript/TypeScript 与 Python SDK 的使用方式
- JavaScript/TypeScript：`sdk/javascript`，直接通过 npm 包复用 `CodeIndex` API
- Python：`sdk/python`，SDK 内置 Node Worker，`pip install` 后即可通过 `CodeIndexClient` 发起查询
  - 📖 [Python SDK 使用文档](sdk/python/README.md)

### Python SDK 安装

```bash
pip install lydiacai-codeindex-sdk
```

📦 **PyPI 地址**：[https://pypi.org/project/lydiacai-codeindex-sdk/0.1.0/](https://pypi.org/project/lydiacai-codeindex-sdk/0.1.0/)

### Python SDK 快速示例

```python
from codeindex_sdk import CodeIndexClient, CodeIndexConfig

config = CodeIndexConfig(
    root_dir="/path/to/project",
    db_path=".codeindex/project.db",
    languages=["go", "ts", "py"],
)

with CodeIndexClient(config) as client:
    # 查找符号
    symbols = client.find_symbols(name="CreateUser", language="go")
    
    # 查询对象属性
    props = client.object_properties(object_name="UserService", language="go")
    
    # 生成调用链
    chain = client.call_chain(from_symbol=12345, direction="forward", depth=2)
```

> 💡 **提示**：使用 Python SDK 前需要先通过 CLI 构建索引数据库（见上方"索引项目"步骤）

## 🗂️ 项目结构

```
src/
├── parser/          # Tree-sitter 封装与语言识别
├── extractor/       # 符号提取器（按语言）
├── indexer/         # 索引引擎
├── storage/         # SQLite 数据访问层
├── query/           # 查询引擎（含语义搜索）
├── summarizer/      # LLM 摘要生成
├── embeddings/      # 向量化生成器
├── watcher/         # 文件监听器
└── cli/             # 命令行工具
```

## 📄 许可证

MIT License

---

## ⭐ Star History

如果这个项目对你有帮助，欢迎给个 Star！

[![Star History Chart](https://api.star-history.com/svg?repos=LydiaCai1203/codeindex&type=date&legend=top-left)](https://www.star-history.com/#LydiaCai1203/codeindex&type=date&legend=top-left)

---

## 💬 社区交流

如果你也在做"让 LLM 更懂代码"的事情，欢迎一起交流与共建！🤝

扫码加入 CodeIndex 交流群：

![CodeIndex 交流群](./codeindex-wx.JPG)

> 提示：二维码有效期 7 天，如过期请联系维护者更新

