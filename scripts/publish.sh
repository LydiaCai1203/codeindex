#!/bin/sh
# CodeIndex 发布脚本
# 用法: ./scripts/publish.sh [npm|pypi|all] [--dry-run]

set -e

PUBLISH_TYPE="${1:-all}"
DRY_RUN="${2:-}"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

info() {
    echo "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo "${RED}[ERROR]${NC} $1"
}

# 检查是否在项目根目录
if [ ! -f "package.json" ]; then
    error "请在项目根目录运行此脚本"
    exit 1
fi

# 发布 npm 主包
publish_npm_main() {
    info "准备发布 npm 主包..."
    
    # 检查是否已登录 npm
    if ! npm whoami > /dev/null 2>&1; then
        error "请先登录 npm: npm login"
        exit 1
    fi
    
    # 构建
    info "构建项目..."
    npm run build
    
    # 检查发布内容
    info "检查将要发布的文件..."
    npm pack --dry-run
    
    if [ "$DRY_RUN" = "--dry-run" ]; then
        info "模拟发布（不会实际上传）..."
        npm publish --dry-run --access public
    else
        read -p "确认发布到 npm? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            npm publish --access public
            info "✅ npm 主包发布成功！"
        else
            warn "已取消发布"
        fi
    fi
}

# 发布 npm SDK
publish_npm_sdk() {
    info "准备发布 npm SDK..."
    
    cd sdk/javascript
    
    # 构建
    info "构建 JavaScript SDK..."
    npm run build
    
    # 检查发布内容
    info "检查将要发布的文件..."
    npm pack --dry-run
    
    if [ "$DRY_RUN" = "--dry-run" ]; then
        info "模拟发布（不会实际上传）..."
        npm publish --dry-run --access public
    else
        read -p "确认发布 JavaScript SDK 到 npm? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            npm publish --access public
            info "✅ JavaScript SDK 发布成功！"
        else
            warn "已取消发布"
        fi
    fi
    
    cd ../..
}

# 发布 Python SDK
publish_pypi() {
    info "准备发布 Python SDK 到 PyPI..."
    
    cd sdk/python
    
    # 检查 twine 是否安装
    if ! command -v twine > /dev/null 2>&1; then
        error "请先安装 twine: pip install build twine"
        exit 1
    fi
    
    # 清理旧构建
    info "清理旧的构建产物..."
    rm -rf dist/ build/ *.egg-info/
    
    # 构建
    info "构建 Python 包..."
    python -m build
    
    # 检查
    info "检查构建产物..."
    twine check dist/*
    
    if [ "$DRY_RUN" = "--dry-run" ]; then
        info "模拟发布到 TestPyPI（不会实际上传）..."
        twine upload --repository testpypi dist/* --skip-existing || true
    else
        read -p "确认发布到 PyPI? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            twine upload dist/*
            info "✅ Python SDK 发布成功！"
        else
            warn "已取消发布"
        fi
    fi
    
    cd ../..
}

# 主流程
case "$PUBLISH_TYPE" in
    npm)
        publish_npm_main
        publish_npm_sdk
        ;;
    pypi)
        publish_pypi
        ;;
    all)
        publish_npm_main
        publish_npm_sdk
        publish_pypi
        ;;
    *)
        error "未知的发布类型: $PUBLISH_TYPE"
        echo "用法: $0 [npm|pypi|all] [--dry-run]"
        exit 1
        ;;
esac

info "🎉 发布流程完成！"

