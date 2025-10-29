# Chunk Annotation Design

## 背景
目前的索引流程已经能抽取文件、符号、调用链、引用等结构化信息。但在后续让大模型回答问题时，仍缺乏“块级”语义总结，导致检索命中率偏低。我们希望以符号为粒度切分代码块，并为每个块生成说明性注释，入库后可直接用于召回或外部知识库同步。

## 设计目标
- **最小改动复用现有存储**：继续沿用 `.codeindex/sqlite.db`，不新增表，只在 `symbols` 表追加字段即可承载块摘要。
- **块=符号**：每条 `symbol` 即代表一个可独立索引的代码块（函数、方法、结构体、接口、字段等）。利用现有的位置信息可回溯源代码片段。
- **增量更新友好**：通过新增的 `chunk_hash` 标识块内容是否变化，仅当块内容更改时才重新生成注释。
- **兼容现有查询**：`symbol_id` 继续作为调用链、引用、属性查询的外键，新增信息不会破坏既有逻辑。

## Schema 调整
在 `symbols` 表新增字段：
- `chunk_hash TEXT`：基于符号对应源码切片（含签名 + 体）计算的哈希，用于判断块是否需要重跑 LLM。
- `chunk_summary TEXT`：LLM 生成的中文或英文注释文本，默认 `NULL`。
- `summary_tokens INTEGER`（可选）：记录提示词消耗的 token 数，便于计费统计。
- `summarized_at INTEGER`（可选）：Unix 时间戳，记录最后一次摘要时间。

> 重建策略：无历史用户与数据保留需求，直接在初始化 schema 中包含上述字段；如存在旧库，先删除再重建，无需迁移。

对应 `SymbolRecord` 类型需同步扩展，可选属性不会影响现有调用。

## 摘要生成流程
1. **索引阶段不变**：`Indexer#indexFile` 继续抽取符号、调用、引用并写入数据库。
2. **待处理队列**：索引后，根据 `chunk_hash` 与数据库记录比较，筛选出新增或变更的符号，形成待摘要列表。
3. **LLM Summarizer**（新模块）：
   - 输入：符号基本信息（名称、签名、语言）以及源代码片段（根据 `start_line/end_line` 读取）。
   - 产出：结构化响应（摘要文本、token 数等）。
   - 写回：调用 `CodeDatabase` 新增的 `updateSymbolSummary`（待实现）接口，更新 `chunk_summary`、`chunk_hash`、`summary_tokens`、`summarized_at`。
4. **并发/重试**：可按批次调用 LLM，失败的记录保留旧值并记录日志，后续重试。

## API & Type 更新
- `SymbolRecord` 增加可选字段：`chunkHash?`, `chunkSummary?`, `summaryTokens?`, `summarizedAt?`。
- `CodeDatabase` 调整：
  - `insertSymbol` 支持写入新增字段（默认 `null`）。
  - 新增 `updateSymbolSummary(symbolId, payload)` 方法，封装 `UPDATE symbols SET ... WHERE symbol_id = ?`。
  - 查询接口（`getSymbolById`、`getAllSymbols`、`getSymbolsInFile` 等）返回值自动包含新字段。
- `QueryEngine` 若需展示摘要，可直接读取 `chunkSummary`；原有逻辑保持兼容。

## 后续扩展
- **多语言总结策略**：可根据 `language` 选择不同的 prompt 模板。
- **多版本摘要**：若未来需要存储多套摘要，可考虑新增 `symbol_chunks` 表，将版本信息拆分出去。
- **文档/嵌入管道**：摘要生成后，可进一步生成向量嵌入并写入独立表或外部向量库。

## 实施步骤
1. 修改 `src/storage/database.ts` 初始化 SQL，直接包含新增列；无需迁移，允许删除旧库并重建。
2. 更新 `src/core/types.ts` 中的 `SymbolRecord` 定义。
3. 在 `CodeDatabase` 中增加 `updateSymbolSummary` 等辅助方法。
4. 在索引完成后增加一个 summarizer workflow（可先写成脚本/CLI 命令）。
5. 编写文档与测试，确保旧数据不会报错，新字段读写正常。
