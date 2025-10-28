#!/bin/sh
# 重新构建 monkeycode-ai 项目的代码索引（完全清空并重建）
# 使用方法: sh rebuild-monkeycode-ai.sh

set -e

echo "🔄 开始重新构建 monkeycode-ai 代码索引..."
echo "⚠️  这将清空现有索引并完全重建"
echo ""

# 项目路径
PROJECT_ROOT="/Users/caiqj/project/company/new/monkeycode-ai"
DB_PATH=".codeindex/monkeycode-ai.db"

# 检查项目是否存在
if [ ! -d "$PROJECT_ROOT" ]; then
    echo "❌ 错误: 项目路径不存在: $PROJECT_ROOT"
    exit 1
fi

# 重建索引
node dist/src/cli/index.js rebuild \
    --root "$PROJECT_ROOT" \
    --db "$DB_PATH" \
    --lang go \
    --include "**/*.go" \
    --exclude "**/vendor/**" "**/node_modules/**" "**/.git/**" "**/pg_data/**" "**/data/**" "**/bin/**" "**/build/**"

echo ""
echo "✅ 重建完成！"
echo "📊 数据库位置: $DB_PATH"

