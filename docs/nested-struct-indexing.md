# 嵌套结构体索引功能

## 概述

该功能允许对 Go 语言中的嵌套结构体进行深度可控的索引。支持**匿名嵌套结构体**和**嵌入字段（embedded fields）**的递归索引。

## 功能特性

### 支持的嵌套模式

1. **命名类型的嵌套结构体**
```go
type Address struct {
    Street string
    City   string
}

type User struct {
    Name    string
    Address Address  // 会被索引为 User.Address
}
```

2. **匿名嵌套结构体**
```go
type Person struct {
    Name string
    ContactInfo struct {  // 匿名嵌套
        Email string      // 会被索引为 Person.ContactInfo.Email
        Phone string      // 会被索引为 Person.ContactInfo.Phone
    }
}
```

3. **深层嵌套**
```go
type ComplexStruct struct {
    Metadata struct {
        Author struct {
            Name  string  // 会被索引为 ComplexStruct.Metadata.Author.Name
            Email string
        }
    }
}
```

4. **嵌入字段（Embedded Fields）**
```go
type Person struct {
    Name string
}

type Employee struct {
    Person     // 嵌入字段，会被索引为 Employee.Person
    EmployeeID string
}
```

## 使用方法

### CLI 参数

使用 `--max-nested-depth` 参数控制递归深度：

```bash
# 默认深度为 3
node dist/src/cli/index.js index \
    --root ./myproject \
    --db .codeindex/mydb.db \
    --lang go \
    --include "**/*.go" \
    --max-nested-depth 3

# 不索引嵌套字段
node dist/src/cli/index.js index \
    --root ./myproject \
    --db .codeindex/mydb.db \
    --lang go \
    --max-nested-depth 0

# 索引更深的嵌套（深度 5）
node dist/src/cli/index.js index \
    --root ./myproject \
    --db .codeindex/mydb.db \
    --lang go \
    --max-nested-depth 5
```

### API 使用

```typescript
import { CodeIndex } from '@codeindex/ast-demo';

const index = await CodeIndex.create({
  rootDir: './myproject',
  dbPath: '.codeindex/mydb.db',
  languages: ['go'],
  include: ['**/*.go'],
  maxNestedStructDepth: 3,  // 设置最大嵌套深度
});

await index.reindexAll();

// 查询嵌套字段
const emailFields = await index.findSymbols({ name: 'Email' });
emailFields.forEach(field => {
  console.log(field.qualifiedName);
  // 例如: main.Person.ContactInfo.Email
});
```

## 深度说明

深度是指从父结构体开始的嵌套层级数：

```go
type Example struct {
    Field1 string          // 深度 0 (直接字段)
    Nested1 struct {       // 深度 0 (直接字段)
        Field2 string      // 深度 1 (嵌套 1 层)
        Nested2 struct {   // 深度 1
            Field3 string  // 深度 2 (嵌套 2 层)
        }
    }
}
```

- `maxNestedStructDepth = 0`: 只索引 Field1 和 Nested1，不索引嵌套内容
- `maxNestedStructDepth = 1`: 索引到 Field2 和 Nested2
- `maxNestedStructDepth = 2`: 索引到 Field3
- `maxNestedStructDepth = 3` (默认): 适合大多数项目

## 性能建议

1. **默认值 (3)**: 适合大多数项目，平衡索引速度和功能完整性
2. **深度 0**: 最快的索引速度，只索引顶层字段
3. **深度 5+**: 适用于有极深嵌套的特殊项目，但会增加索引时间

## 示例

运行示例演示：

```bash
# 测试不同深度
node examples/demo-nested-struct.ts 0  # 不索引嵌套
node examples/demo-nested-struct.ts 1  # 深度 1
node examples/demo-nested-struct.ts 3  # 深度 3（默认）
node examples/demo-nested-struct.ts 5  # 深度 5
```

## 查询索引的字段

```bash
# 查找特定字段
node dist/src/cli/index.js symbol 'Email' --lang go --db .codeindex/mydb.db

# 查看结构体的所有属性
node dist/src/cli/index.js properties 'Person' --db .codeindex/mydb.db
```

## 已知限制

1. 不会自动展开嵌入字段的属性（例如 `Employee.Person.Name` 不会被展开为 `Employee.Name`）
2. 深度限制从**匿名嵌套结构体**开始计算，命名类型的结构体会单独索引
3. 超过设定深度的嵌套字段不会被索引

## 相关文件

- 源代码: `src/extractor/go-extractor.ts`
- 测试文件: `examples/nested-struct-test.go`
- 演示脚本: `examples/demo-nested-struct.ts`

