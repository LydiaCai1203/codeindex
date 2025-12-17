# Python SDK 自然语言查询功能

## 概述

Python SDK 现在支持使用自然语言进行语义搜索，类似于 Node.js CLI 的 `search` 命令。用户只需提供查询文本，SDK 会自动调用 embedding API 生成查询向量并执行搜索。

## 功能特性

- ✅ **自然语言查询**：直接使用自然语言文本进行搜索，无需手动生成 embedding
- ✅ **自动配置加载**：支持从 `codeindex.config.json` 配置文件读取 embedding API 配置
- ✅ **环境变量支持**：支持通过环境变量配置 embedding API
- ✅ **向后兼容**：保留原有的 `query_embedding` 参数，支持手动提供 embedding
- ✅ **灵活配置**：支持在代码中直接传递 embedding API 配置

## 使用方法

### 1. 基本用法（推荐）

```python
from codeindex import CodeIndexClient

with CodeIndexClient(".codeindex/project.db") as client:
    # 自然语言查询，自动从配置文件读取 embedding 配置
    results = client.semantic_search(
        query="用户登录验证",
        top_k=5
    )
    
    for result in results:
        symbol = result['symbol']
        print(f"{symbol['kind']} {symbol['qualifiedName']}")
        print(f"  相似度: {result['similarity']:.1%}")
        print(f"  位置: {result['location']['path']}:{result['location']['startLine']}")
```

### 2. 配置方式

配置优先级（从高到低）：
1. **函数参数**：直接在代码中传递
2. **环境变量**（推荐）：设置环境变量
3. **配置文件**：在项目根目录或数据库目录创建 `codeindex.config.json`

#### 方式1：环境变量（推荐）

```json
{
  "embedding": {
    "apiEndpoint": "https://api.example.com/v1/embeddings",
    "apiKey": "your-api-key",
    "model": "bge-m3",
    "dimension": 1024,
    "defaultModel": "bge-m3",
    "timeout": 30,
    "maxRetries": 3
  }
}
```

#### 方式2：环境变量

```bash
export CODEINDEX_EMBEDDING_API_ENDPOINT="https://api.example.com/v1/embeddings"
export CODEINDEX_EMBEDDING_API_KEY="your-api-key"
```

#### 方式3：代码中传递

```python
results = client.semantic_search(
    query="用户登录验证",
    api_endpoint="https://api.example.com/v1/embeddings",
    api_key="your-api-key",
    model="bge-m3",
    top_k=5
)
```

### 3. 配置优先级

配置的优先级顺序（从高到低）：
1. 函数参数（`api_endpoint`, `api_key`, `model` 等）
2. 环境变量（`CODEINDEX_EMBEDDING_API_ENDPOINT`, `CODEINDEX_EMBEDDING_API_KEY`, `CODEINDEX_EMBEDDING_MODEL`）
3. `codeindex.config.json` 配置文件
4. 默认值

### 4. 完整示例

```python
from codeindex import CodeIndexClient

with CodeIndexClient(".codeindex/project.db") as client:
    # 带过滤条件的查询
    results = client.semantic_search(
        query="用户登录验证",
        top_k=5,
        language="go",  # 只搜索 Go 代码
        kind="function",  # 只搜索函数
        min_similarity=0.7  # 最小相似度阈值
    )
    
    for idx, result in enumerate(results, 1):
        symbol = result['symbol']
        print(f"{idx}. {symbol['kind']} {symbol['qualifiedName']}")
        print(f"   相似度: {result['similarity']:.1%}")
        print(f"   位置: {result['location']['path']}:{result['location']['startLine']}")
        if symbol.get('chunkSummary'):
            print(f"   摘要: {symbol['chunkSummary'][:80]}...")
        print()
```

## API 参考

### `semantic_search` 方法

```python
def semantic_search(
    query: str | None = None,
    query_embedding: List[float] | None = None,
    model: str | None = None,
    top_k: int = 10,
    language: str | None = None,
    kind: str | None = None,
    min_similarity: float = 0.7,
    api_endpoint: str | None = None,
    api_key: str | None = None,
    dimension: int | None = None,
    **kwargs: Any
) -> List[Dict[str, Any]]
```

**参数说明：**

- `query` (str, optional): 自然语言查询文本。如果未提供 `query_embedding`，则必需。
- `query_embedding` (List[float], optional): 预计算的查询 embedding 向量。如果未提供，将从 `query` 自动生成。
- `model` (str, optional): Embedding 模型名称。将从配置文件读取，如果未配置则必需。
- `top_k` (int): 返回结果数量，默认 10。
- `language` (str, optional): 语言过滤器（如 "go", "ts", "python"）。
- `kind` (str, optional): 符号类型过滤器（如 "function", "class", "struct"）。
- `min_similarity` (float): 最小相似度阈值（0.0-1.0），默认 0.7。
- `api_endpoint` (str, optional): Embedding API 端点。
- `api_key` (str, optional): Embedding API 密钥。
- `dimension` (int, optional): Embedding 维度。

**返回值：**

搜索结果列表，每个结果包含：
- `symbol`: 符号信息字典（包含 name, kind, qualifiedName, chunkSummary 等）
- `similarity`: 相似度分数（0.0-1.0）
- `location`: 位置信息字典（包含 path, startLine, endLine 等）

## 实现细节

### 新增组件

1. **`EmbeddingsGenerator` 类** (`embeddings_generator.py`)
   - 负责调用 embedding API 生成向量
   - 支持多种 API 响应格式
   - 自动归一化向量（用于余弦相似度计算）

2. **配置加载机制** (`client.py`)
   - 自动查找 `codeindex.config.json` 配置文件
   - 支持从数据库目录、当前目录及其父目录查找配置
   - 支持环境变量配置

3. **增强的 `semantic_search` 方法**
   - 自动检测是否需要生成 embedding
   - 支持多种配置方式
   - 保持向后兼容性

### 工作流程

1. 用户调用 `semantic_search(query="...")`
2. SDK 检查是否提供了 `query_embedding`
3. 如果未提供，则：
   - 加载配置文件或从参数/环境变量获取 embedding API 配置
   - 创建 `EmbeddingsGenerator` 实例
   - 调用 embedding API 生成查询向量
4. 使用生成的向量执行语义搜索
5. 返回搜索结果

## 依赖要求

- `numpy >= 1.24.0`（用于向量计算）
- `requests >= 2.28.0`（用于调用 embedding API）

## 示例脚本

提供了一个示例脚本 `example_search.py`，演示如何使用自然语言查询：

```bash
python example_search.py "用户登录验证" --top-k 5
```

## 注意事项

1. **前置要求**：需要先使用 CLI 生成 embedding：
   ```bash
   node dist/cli/index.js embed --db .codeindex/project.db
   ```

2. **模型一致性**：确保查询时使用的 embedding 模型与生成索引时使用的模型一致。

3. **API 配置**：必须配置 embedding API（配置文件、环境变量或参数）。

4. **性能考虑**：每次查询都会调用 embedding API，可能会有网络延迟。建议：
   - 缓存常用查询的 embedding
   - 使用批量查询（如果 API 支持）

## 与 Node.js CLI 的对应关系

Python SDK 的 `semantic_search` 方法对应 Node.js CLI 的 `search` 命令：

**Node.js CLI:**
```bash
node dist/cli/index.js search "用户登录验证" --top-k 5
```

**Python SDK:**
```python
results = client.semantic_search(query="用户登录验证", top_k=5)
```

两者功能完全一致，只是调用方式不同。

