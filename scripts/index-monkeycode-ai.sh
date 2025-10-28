#!/bin/sh
# 为 codingmatrix 项目构建代码索引
# 使用方法: sh index-codingmatrix.sh

set -e

echo "🚀 开始为 codingmatrix 构建代码索引..."
echo ""

# 项目路径
PROJECT_ROOT="/Users/caiqj/project/company/new/codingmatrix"
DB_PATH=".codeindex/codingmatrix.db"

# 检查项目是否存在
if [ ! -d "$PROJECT_ROOT" ]; then
    echo "❌ 错误: 项目路径不存在: $PROJECT_ROOT"
    exit 1
fi

# 构建索引
node dist/src/cli/index.js index \
    --root "$PROJECT_ROOT" \
    --db "$DB_PATH" \
    --lang go \
    --include "**/*.go" \
    --exclude "**/vendor/**" "**/node_modules/**" "**/.git/**" "**/pg_data/**" "**/data/**" "**/bin/**" "**/build/**" "**/*.pb.go" "**/*.pb.gw.go" \
    --max-nested-depth 5

echo ""
echo "✅ 索引构建完成！"
echo "📊 数据库位置: $DB_PATH"
echo ""
echo "💡 使用示例:"
echo "  # 查找函数"
echo "  node dist/src/cli/index.js symbol 'CreateUser' --lang go --db $DB_PATH"
echo ""
echo "  # 查看结构体方法"
echo "  node dist/src/cli/index.js properties 'UserService' --db $DB_PATH"
echo ""
echo "  # 生成调用链"
echo "  node dist/src/cli/index.js call-chain --from <symbolId> --db $DB_PATH --pretty"

