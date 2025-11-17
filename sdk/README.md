# SDK 目录说明

为了让不同语言的调用方都能直接复用 CodeIndex 的能力，本目录提供官方 SDK：

## 已支持

- `javascript/`：JavaScript/TypeScript SDK，提供 `CodeIndex` 的 npm 包入口，适合在 Node.js 应用或 AutoSpecMan 的 JS 任务中使用。
- `python/`：Python SDK，内部自动启动 Node Worker，暴露纯 Python API，可直接 `pip install` 后调用。

## 未来规划

- 预留 `sdk/<language>/` 结构，欢迎贡献 Go/Rust 等语言版本，只需要遵循“独立包 + 中文 README”的规范即可。

## 使用建议

1. 在使用任意 SDK 之前，先通过 CLI 或 Node API 构建索引数据库（`.codeindex/*.db`）。
2. JavaScript SDK 更适合与现有 Node 工程集成；Python SDK 更适合 AutoSpecMan/数据分析脚本等场景。
3. 若需要其它语言支持，可参考 Python Worker 的协议（JSON-RPC），通过任意语言实现客户端。

