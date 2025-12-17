# CodeIndex Python SDK 重构实现计划

## 📋 目标

将 Python SDK 从基于 Node.js Worker 的架构重构为直接访问 SQLite 数据库的架构，实现：
- ✅ 移除 Node.js 依赖
- ✅ 提升性能（无进程间通信）
- ✅ 简化部署（只需 Python 和数据库文件）
- ✅ 保持 API 向后兼容

## 🗂️ 文件结构规划

### 现有文件（保留/修改）
```
sdk/python/
├── codeindex_sdk/
│   ├── __init__.py          # 更新导出
│   ├── client.py            # 重构：直接使用数据库
│   ├── config.py            # 简化：只需 db_path
│   ├── exceptions.py        # 更新：添加数据库相关异常
│   └── node_runner.py       # 标记为废弃（保留用于兼容）
├── pyproject.toml           # 更新依赖：添加 numpy
├── README.md                 # 更新文档
├── MANIFEST.in              # 更新：移除 worker_server.js
└── test_client.py            # 更新测试
```

### 新增文件
```
sdk/python/
├── codeindex_sdk/
│   ├── database.py          # 新增：数据库访问层
│   ├── query.py             # 新增：查询引擎
│   └── types.py             # 新增：类型定义
└── IMPLEMENTATION_PLAN.md   # 本文件
```

## 📝 实现步骤

### Phase 1: 创建核心模块

#### 1.1 创建 `types.py`
- [ ] 定义所有数据类型（Location, SymbolRecord, CallRecord 等）
- [ ] 定义类型别名（Language, SymbolKind, ReferenceKind）
- [ ] 使用 dataclass 和 Literal 类型

#### 1.2 创建 `database.py`
- [ ] 实现 `CodeIndexDatabase` 类
- [ ] 实现文件操作（get_file_by_path, get_file_by_id）
- [ ] 实现符号操作（find_symbols_by_name, get_symbol_by_id）
- [ ] 实现调用关系操作（get_calls_from, get_calls_to）
- [ ] 实现引用操作（get_references_to_symbol）
- [ ] 实现嵌入向量操作（get_embeddings_by_model）
- [ ] 实现辅助方法（_row_to_symbol, _row_to_call 等）
- [ ] 处理 SQLite BLOB 到 Python list 的转换

#### 1.3 创建 `query.py`
- [ ] 实现 `CodeIndexQuery` 类
- [ ] 实现 find_symbol / find_symbols
- [ ] 实现 get_definition / get_references
- [ ] 实现 build_call_chain（递归构建调用链）
- [ ] 实现 get_object_properties（支持 Go 特殊处理）
- [ ] 实现 semantic_search（使用 numpy 计算相似度）
- [ ] 实现数据转换方法（_symbol_to_dict）

### Phase 2: 重构客户端

#### 2.1 重构 `client.py`
- [ ] 移除 NodeWorker 相关代码
- [ ] 使用 CodeIndexDatabase 和 CodeIndexQuery
- [ ] 保持原有 API 接口不变
- [ ] 实现 context manager（__enter__/__exit__）
- [ ] 实现延迟连接（首次调用时连接）

#### 2.2 简化 `config.py`
- [ ] 保留 CodeIndexConfig 类（向后兼容）
- [ ] 简化参数：只需 db_path
- [ ] 其他参数标记为可选（用于兼容）

#### 2.3 更新 `exceptions.py`
- [ ] 添加 DatabaseNotFoundError
- [ ] 添加 DatabaseError
- [ ] 保留旧异常（标记为 deprecated）

### Phase 3: 更新配置和文档

#### 3.1 更新 `__init__.py`
- [ ] 导出新模块（database, query, types）
- [ ] 保留旧导出（向后兼容）

#### 3.2 更新 `pyproject.toml`
- [ ] 添加 numpy 依赖
- [ ] 更新版本号（0.2.0）
- [ ] 更新描述

#### 3.3 更新 `MANIFEST.in`
- [ ] 移除 worker_server.js
- [ ] 保留其他文件

#### 3.4 更新 `README.md`
- [ ] 更新安装说明
- [ ] 更新使用示例
- [ ] 说明新架构优势
- [ ] 添加迁移指南

### Phase 4: 测试和验证

#### 4.1 更新 `test_client.py`
- [ ] 更新测试用例
- [ ] 测试所有 API 方法
- [ ] 测试错误处理

#### 4.2 功能测试
- [ ] 测试符号查询
- [ ] 测试调用链构建
- [ ] 测试对象属性查询
- [ ] 测试语义搜索（如果有 embedding）

## 🔧 技术细节

### 数据库 Schema 映射

| TypeScript 类型 | Python 类型 | 说明 |
|----------------|-------------|------|
| `Location` | `Location` (dataclass) | 位置信息 |
| `SymbolRecord` | `SymbolRecord` (dataclass) | 符号记录 |
| `CallRecord` | `CallRecord` (dataclass) | 调用记录 |
| `ReferenceRecord` | `ReferenceRecord` (dataclass) | 引用记录 |

### SQLite BLOB 处理

嵌入向量在数据库中存储为 BLOB，需要转换：
- **读取**：BLOB → bytes → list[float]
- **写入**：list[float] → bytes → BLOB（如果需要）

### 相似度计算

使用 numpy 计算余弦相似度：
```python
import numpy as np
query_array = np.array(query_embedding)
candidate_array = np.array(candidate_embedding)
similarity = np.dot(query_array, candidate_array)  # 假设已归一化
```

### 向后兼容性

1. **API 兼容**：保持 `CodeIndexClient` 接口不变
2. **配置兼容**：`CodeIndexConfig` 接受旧参数但忽略
3. **异常兼容**：保留旧异常类（标记 deprecated）

## 📊 性能对比

| 指标 | 旧架构（Node Worker） | 新架构（直接 DB） |
|------|---------------------|------------------|
| 启动时间 | ~500ms（启动 Node 进程） | ~10ms（连接数据库） |
| 查询延迟 | ~50-100ms（进程通信） | ~1-5ms（直接查询） |
| 内存占用 | Node 进程 + Python | 仅 Python |
| 依赖要求 | Node.js + Python | 仅 Python |

## ⚠️ 注意事项

1. **嵌入向量格式**：需要确认 SQLite 中 BLOB 的字节序（little-endian）
2. **并发访问**：SQLite 支持多读，但写入需要锁
3. **数据库版本**：确保 SQLite 版本 >= 3.35.0（支持 RETURNING）
4. **类型转换**：注意 SQLite INTEGER 和 Python bool 的转换

## 🚀 迁移路径

### 对于现有用户

1. **无需修改代码**：API 保持不变
2. **更新依赖**：`pip install --upgrade lydiacai-codeindex-sdk`
3. **移除 Node.js**：不再需要 Node.js 运行时

### 配置简化

**旧配置**：
```python
config = CodeIndexConfig(
    root_dir="/path/to/project",
    db_path=".codeindex/project.db",
    languages=["go", "ts"],
)
```

**新配置**（简化）：
```python
# 方式1：直接使用 db_path
client = CodeIndexClient(".codeindex/project.db")

# 方式2：使用 config（向后兼容）
config = CodeIndexConfig(db_path=".codeindex/project.db")
client = CodeIndexClient(config.db_path)
```

## 📅 时间估算

- Phase 1: 2-3 小时（核心模块）
- Phase 2: 1-2 小时（客户端重构）
- Phase 3: 1 小时（配置和文档）
- Phase 4: 1-2 小时（测试）

**总计**：约 5-8 小时

## ✅ 验收标准

1. ✅ 所有现有测试通过
2. ✅ 无需 Node.js 即可运行
3. ✅ API 完全向后兼容
4. ✅ 性能提升明显（查询延迟 < 10ms）
5. ✅ 文档完整更新
6. ✅ 代码通过类型检查（mypy）

## 🔄 后续优化（可选）

1. 添加连接池支持
2. 添加异步 API（async/await）
3. 添加批量查询接口
4. 添加缓存层
5. 支持只读副本（read replicas）

