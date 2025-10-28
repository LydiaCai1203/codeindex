# 语言支持与测试说明

本文汇总各语言当前支持范围、已测试内容与待优化事项。

图例：✅ 完整/已测 ｜ ⚠️ 基础/部分 ｜ 🧩 待实现

## TypeScript / JavaScript
- 解析器：tree-sitter-typescript（ts/tsx）、tree-sitter-javascript（js/jsx）
- 符号：✅ function、method、class、interface、variable、constant、property、type、module/namespace
- 调用：✅ 调用表达式提取 caller→callee
- 属性：✅ 类的属性/方法（qualifiedName 前缀匹配）
- 已测试：示例代码、CLI 与 Node API 基本流程
- 待优化：
  - ⚠️ 高级类型（泛型、映射类型等）未深度建模
  - ⚠️ 跨文件 re-export 与模块解析未完备

## Go
- 解析器：tree-sitter-go
- 符号：✅ function、method（含接收者）、struct、interface、field、constant、variable、type
- 调用：✅ 一般函数/方法调用；基于接收者类型补全
- 属性：✅ struct 字段与方法、✅ interface 方法（method_elem）
- 已测试：
  - monkeycode-ai 仓库（成功索引 300+ 文件）
  - struct 字段/方法、interface 方法的 `properties` 查询
  - 调用链（pretty 树形与 JSON）
- 待优化：
  - ⚠️ ent 生成文件中的个别语法导致解析失败（不影响主流程）
  - ⚠️ 内嵌 struct 与提升字段未做展开
  - ⚠️ 跨文件/包的精确消歧可以加强

## Python
- 解析器：tree-sitter-python
- 符号：✅ function、class、method、property（@property）、variable、constant
- 调用：✅ 调用表达式
- 属性：✅ 类的属性/方法
- 已测试：示例代码、CLI 与 Node API 基本流程
- 待优化：
  - ⚠️ 除 @property 外的装饰器语义未建模
  - ⚠️ 动态属性/鸭子类型无法静态捕获

## 跨语言能力
- 增量索引：✅ 内容哈希 + mtime
- 重建：✅ 清空 + 重建 + VACUUM
- 查询：✅ 符号、属性、调用链（正/反向，支持 depth）
- 输出：✅ 树形美化（pretty）与 JSON

## 待办与演进方向
- 🧩 新语言适配：Java、Rust
- 🧩 跨文件/模块解析与消歧
- 🧩 引用查询增强（read/write/import 的丰富查询）
- 🧩 重查询缓存（如 `getAllSymbols`）
- 🧩 数据库索引优化（如 `qualified_name` 上建索引）
