#!/usr/bin/env python3
"""测试 CodeIndex Python SDK"""

import sys
from pathlib import Path

from codeindex_sdk import CodeIndexClient, CodeIndexConfig

def main():
    # 配置：使用已存在的索引数据库
    test_db = Path("../../.codeindex/codingmatrix.db").resolve()
    test_root = Path("../../").resolve()
    
    # 如果数据库不存在，提示用户先建立索引
    if not test_db.exists():
        print(f"❌ 索引数据库不存在: {test_db}")
        print("请先使用 CodeIndex CLI 建立索引：")
        print(f"  node ../../dist/cli/index.js index \\")
        print(f"    --root {test_root.absolute()} \\")
        print(f"    --db {test_db.absolute()} \\")
        print(f"    --lang ts --include '**/*.ts'")
        sys.exit(1)
    
    # 创建配置
    # 注意：CodeIndex 支持的语言代码是 "python" 而不是 "py"
    config = CodeIndexConfig(
        root_dir=str(test_root.absolute()),
        db_path=str(test_db.absolute()),
        languages=["ts", "js", "go", "python"],
    )
    
    print("🚀 开始测试 CodeIndex Python SDK...")
    print(f"📁 根目录: {config.root_dir}")
    print(f"💾 数据库: {config.db_path}")
    print()
    
    try:
        # 使用 context manager 自动管理 Worker 生命周期
        with CodeIndexClient(config) as client:
            print("✅ Worker 启动成功")
            print()
            
            # 测试 1: 查找符号
            print("测试 1: 查找符号...")
            try:
                symbols = client.find_symbols(name="CreateEnvironment", language="golang")
                if symbols:
                    print(f"✅ 找到 {len(symbols)} 个符号")
                    for sym in symbols[:3]:  # 只显示前 3 个
                        print(f"  - {sym.get('name', 'N/A')} ({sym.get('kind', 'N/A')})")
                else:
                    print("⚠️  未找到符号")
            except Exception as e:
                print(f"❌ 查找符号失败: {e}")
            print()
            
            # 测试 2: 查找单个符号
            print("测试 2: 查找单个符号...")
            try:
                symbol = client.find_symbol(name="GatewayConfig", language="golang")
                if symbol:
                    print(f"✅ 找到符号: {symbol.get('name', 'N/A')}")
                    print(f"   类型: {symbol.get('kind', 'N/A')}")
                    print(f"   位置: {symbol.get('location', {}).get('path', 'N/A')}")
                else:
                    print("⚠️  未找到符号")
            except Exception as e:
                print(f"❌ 查找单个符号失败: {e}")
            print()
            
            # 测试 3: 查询对象属性（如果有相关符号）
            print("测试 3: 查询对象属性...")
            try:
                # 假设查找一个常见的类名
                props = client.object_properties("GatewayConfig", language="ts")
                if props:
                    print(f"✅ 找到 {len(props)} 个属性/方法")
                    for prop in props[:5]:  # 只显示前 5 个
                        print(f"  - {prop.get('name', 'N/A')} ({prop.get('kind', 'N/A')})")
                else:
                    print("⚠️  未找到属性")
            except Exception as e:
                print(f"❌ 查询对象属性失败: {e}")
            print()
            
            print("✅ 测试完成！")
            
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()

