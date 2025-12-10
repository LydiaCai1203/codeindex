#!/bin/sh

# PyPI 发布脚本
# 使用方法: ./publish.sh

set -e

PYPI_TOKEN="${PYPI_TOKEN:-pypi-AgEIcHlwaS5vcmcCJGQ1OGNkNGE5LWI3NTgtNGM2ZS1iMWY3LWNhODYyYzNhYzBiMwACKlszLCJjMjY0NWM5ZS0xMjQ4LTQ1MjctOTk1OS1hYWM5YTk2OWNmOTUiXQAABiBZ2Dxkpa-swyMRau1Bj52IgpIXQ8t-elzmmxblEGrWGA}"

echo "📦 检查依赖..."
if ! command -v twine > /dev/null 2>&1; then
    echo "安装 twine..."
    pip install --upgrade twine build
fi

echo "🔨 清理旧的构建文件..."
rm -rf dist/ build/ *.egg-info

echo "🏗️  构建分发包..."
python -m build

echo "✅ 检查构建产物..."
ls -lh dist/

echo "📤 上传到 PyPI..."
twine upload dist/* \
    --username __token__ \
    --password "$PYPI_TOKEN" \
    --verbose

echo "🎉 发布完成！"
echo "你可以通过以下命令安装："
echo "  pip install lydiacai-codeindex-sdk"

