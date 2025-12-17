# CodeIndex Python SDK

直接访问 CodeIndex SQLite 数据库的 Python SDK，无需 Node.js 运行时。

## ✨ 主要特性

- ✅ **无需 Node.js**：直接读取 SQLite 数据库，无需启动 Node.js 进程
- ✅ **性能更好**：无进程间通信开销，查询延迟从 50-100ms 降至 1-5ms
- ✅ **简单易用**：API 清晰直观，保持向后兼容
- ✅ **类型提示**：完整的类型定义，IDE 友好
- ✅ **轻量级**：仅依赖 numpy，无其他重型依赖

## 📦 安装

### 从 PyPI 安装（推荐）

```bash
# 使用阿里云镜像源（推荐，速度更快）
pip install -i https://mirrors.aliyun.com/pypi/simple/ lydiacai-codeindex-sdk

# 或使用官方 PyPI 源
pip install lydiacai-codeindex-sdk
```

### 本地开发安装

```bash
cd sdk/python
pip install -e .
```

## 🚀 快速开始

### 基本使用

```python
from codeindex_sdk import CodeIndexClient

# 方式1：直接使用数据库路径
with CodeIndexClient(".codeindex/project.db") as client:
    # 查找符号
    symbols = client.find_symbols(name="CreateUser", language="go")
    for symbol in symbols:
        print(f"{symbol['name']} at {symbol['location']['path']}:{symbol['location']['startLine']}")
    
    # 查找单个符号
    symbol = client.find_symbol("CreateUser", language="go")
    if symbol:
        print(f"Found: {symbol['qualifiedName']}")
    
    # 查询对象属性
    props = client.object_properties("UserService", language="go")
    for prop in props:
        print(f"{prop['kind']} {prop['name']}")
    
    # 生成调用链
    chain = client.call_chain(from_symbol=12345, direction="forward", depth=3)
    if chain:
        print(f"Call chain: {chain['name']} -> {len(chain.get('children', []))} calls")
    
    # 获取定义位置
    location = client.definition(12345)
    if location:
        print(f"Definition: {location['path']}:{location['startLine']}")
    
    # 获取引用
    refs = client.references(12345)
    print(f"Found {len(refs)} references")
```

### 使用配置对象（向后兼容）

```python
from codeindex_sdk import CodeIndexClient, CodeIndexConfig

# 方式2：使用配置对象（向后兼容）
config = CodeIndexConfig(
    db_path=".codeindex/project.db",
    # 以下参数已废弃，但保留用于兼容性
    root_dir="/path/to/project",
    languages=["go", "ts"],
)

with CodeIndexClient(config) as client:
    symbols = client.find_symbols(name="CreateUser", language="go")
```

### 语义搜索（需要预先生成 embedding）

```python
from codeindex_sdk import CodeIndexClient
import numpy as np

# 注意：需要先使用 CodeIndex CLI 生成 embedding
# 然后使用相同的 embedding 模型生成 query_embedding

with CodeIndexClient(".codeindex/project.db") as client:
    # 假设你已经有了 query_embedding（例如使用 OpenAI API）
    query_embedding = [0.1, 0.2, ...]  # 你的 embedding 向量
    
    results = client.semantic_search(
        query="用户登录验证",
        query_embedding=query_embedding,
        model="text-embedding-3-small",  # 与生成 embedding 时使用的模型一致
        top_k=5,
        language="go",
        min_similarity=0.7
    )
    
    for result in results:
        print(f"{result['symbol']['name']} (similarity: {result['similarity']:.2f})")
```

## 📚 API 文档

### CodeIndexClient

#### `__init__(db_path, **kwargs)`

初始化客户端。

**参数：**
- `db_path` (str | CodeIndexConfig): 数据库文件路径或配置对象
- `node_command`, `worker_path`, `startup_timeout`: 已废弃，忽略

#### `find_symbols(name, language=None) -> List[Dict]`

查找所有匹配名称的符号。

**参数：**
- `name` (str): 符号名称
- `language` (str, optional): 语言过滤器

**返回：** 符号字典列表

#### `find_symbol(name, language=None, in_file=None, kind=None) -> Dict | None`

查找单个匹配条件的符号。

**参数：**
- `name` (str): 符号名称
- `language` (str, optional): 语言过滤器
- `in_file` (str, optional): 文件路径过滤器
- `kind` (str, optional): 符号类型过滤器

**返回：** 符号字典或 None

#### `object_properties(object_name, language=None) -> List[Dict]`

获取对象/类/结构体的属性和方法。

**参数：**
- `object_name` (str): 对象名称
- `language` (str, optional): 语言过滤器

**返回：** 属性字典列表

#### `call_chain(from_symbol, direction="forward", depth=5) -> Dict | None`

构建调用链。

**参数：**
- `from_symbol` (int): 起始符号 ID
- `direction` (str): "forward" 或 "backward"
- `depth` (int): 最大深度

**返回：** 调用链字典或 None

#### `definition(symbol_id) -> Dict | None`

获取符号的定义位置。

**参数：**
- `symbol_id` (int): 符号 ID

**返回：** 位置字典或 None

#### `references(symbol_id) -> List[Dict]`

获取符号的所有引用。

**参数：**
- `symbol_id` (int): 符号 ID

**返回：** 引用位置字典列表

#### `semantic_search(query, query_embedding, model="default", top_k=10, ...) -> List[Dict]`

语义搜索（需要预先生成 embedding）。

**参数：**
- `query` (str): 查询文本（仅供参考）
- `query_embedding` (List[float]): 查询 embedding 向量（必需）
- `model` (str): Embedding 模型名称
- `top_k` (int): 返回结果数量
- `language` (str, optional): 语言过滤器
- `kind` (str, optional): 符号类型过滤器
- `min_similarity` (float): 最小相似度阈值

**返回：** 搜索结果列表（包含相似度分数）

## ⚙️ 工作原理

1. **索引构建**：使用 CodeIndex CLI（TypeScript）构建索引数据库
2. **数据库查询**：Python SDK 直接读取 SQLite 数据库
3. **无需 Node.js**：完全独立于 Node.js 运行时

## 📋 前置要求

- **Python**: >= 3.9
- **索引数据库**：需要先使用 CodeIndex CLI 构建索引
  ```bash
  node dist/src/cli/index.js index --root . --db .codeindex/project.db --lang go
  ```

## 🔄 从旧版本迁移

### 旧版本（0.1.x）

```python
from codeindex_sdk import CodeIndexClient, CodeIndexConfig

config = CodeIndexConfig(
    root_dir="/path/to/project",
    db_path=".codeindex/project.db",
    languages=["go", "ts"],
)

with CodeIndexClient(config) as client:
    symbols = client.find_symbols(name="CreateUser", language="go")
```

### 新版本（0.2.x）

```python
from codeindex_sdk import CodeIndexClient

# 简化：只需数据库路径
with CodeIndexClient(".codeindex/project.db") as client:
    symbols = client.find_symbols(name="CreateUser", language="go")
```

**注意**：旧版本代码无需修改即可运行（向后兼容），但建议更新为新 API。

## 🆚 性能对比

| 指标 | 旧版本（Node Worker） | 新版本（直接 DB） | 提升 |
|------|---------------------|------------------|------|
| 启动时间 | ~500ms | ~10ms | **50x** |
| 查询延迟 | 50-100ms | 1-5ms | **20x** |
| 内存占用 | Node + Python | 仅 Python | **减少 ~50MB** |
| 依赖要求 | Node.js + Python | 仅 Python | **简化** |

## 🐛 常见问题

### Q: 数据库文件不存在？

A: 请先使用 CodeIndex CLI 构建索引：
```bash
node dist/src/cli/index.js index --root . --db .codeindex/project.db --lang go
```

### Q: 语义搜索返回空结果？

A: 确保：
1. 已使用 CLI 生成 embedding：`node dist/src/cli/index.js embed`
2. 使用相同的 embedding 模型生成 query_embedding
3. 检查 `min_similarity` 阈值是否过高

### Q: 如何生成 query_embedding？

A: 使用你选择的 embedding API（如 OpenAI）：
```python
import openai

response = openai.embeddings.create(
    model="text-embedding-3-small",
    input="你的查询文本"
)
query_embedding = response.data[0].embedding
```

## 📄 许可证

MIT License

## 🔗 相关链接

- [CodeIndex 主项目](https://github.com/LydiaCai1203/codeindex)
- [问题反馈](https://github.com/LydiaCai1203/codeindex/issues)
