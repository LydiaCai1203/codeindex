#!/usr/bin/env python3
"""CodeIndex Python SDK 测试用例"""

import sys
from pathlib import Path
from typing import Optional

from codeindex_sdk import CodeIndexClient, CodeIndexConfig, DatabaseNotFoundError


# ============================================================================
# 配置
# ============================================================================

# 测试数据库路径（请根据实际情况修改）
TEST_DB_PATH = Path("/Users/caiqj/project/private/new/ast-demo/.codeindex/codingmatrix.db")
TEST_ROOT = Path("/Users/caiqj/project/private/new/ast-demo")


# ============================================================================
# 测试辅助函数
# ============================================================================

def check_database_exists(db_path: Path) -> bool:
    """检查数据库文件是否存在"""
    if not db_path.exists():
        print(f"❌ 索引数据库不存在: {db_path}")
        print("\n请先使用 CodeIndex CLI 建立索引：")
        print(f"  node dist/src/cli/index.js index \\")
        print(f"    --root {TEST_ROOT} \\")
        print(f"    --db {db_path} \\")
        print(f"    --lang go --include '**/*.go'")
        return False
    return True


def print_section(title: str):
    """打印测试章节标题"""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def print_test(name: str):
    """打印测试名称"""
    print(f"\n📋 {name}")


def print_success(message: str):
    """打印成功消息"""
    print(f"  ✅ {message}")


def print_warning(message: str):
    """打印警告消息"""
    print(f"  ⚠️  {message}")


def print_error(message: str):
    """打印错误消息"""
    print(f"  ❌ {message}")


# ============================================================================
# 测试用例
# ============================================================================

def test_connection(db_path: str) -> Optional[CodeIndexClient]:
    """测试数据库连接"""
    print_test("测试数据库连接")
    try:
        client = CodeIndexClient(db_path)
        client.start()  # 显式启动连接
        print_success("数据库连接成功")
        return client
    except DatabaseNotFoundError as e:
        print_error(f"数据库未找到: {e}")
        return None
    except Exception as e:
        print_error(f"连接失败: {e}")
        import traceback
        traceback.print_exc()
        return None


def test_find_symbols(client: CodeIndexClient):
    """测试查找多个符号"""
    print_test("查找符号（find_symbols）")
    
    test_cases = [
        {"name": "CreateEnvironment", "language": "go"},
        {"name": "GatewayConfig", "language": "go"},
        {"name": "main", "language": None},  # 测试不指定语言
    ]
    
    for case in test_cases:
        try:
            symbols = client.find_symbols(
                name=case["name"],
                language=case["language"]
            )
            
            if symbols:
                print_success(f"找到 {len(symbols)} 个符号: {case['name']}")
                for sym in symbols[:2]:  # 只显示前2个
                    loc = sym.get('location', {})
                    print(f"    • {sym.get('name')} ({sym.get('kind')}) "
                          f"at {loc.get('path', 'N/A')}:{loc.get('startLine', 'N/A')}")
            else:
                print_warning(f"未找到符号: {case['name']}")
        except Exception as e:
            print_error(f"查找失败 {case['name']}: {e}")


def test_find_symbol(client: CodeIndexClient):
    """测试查找单个符号"""
    print_test("查找单个符号（find_symbol）")
    
    test_cases = [
        {"name": "GatewayConfig", "language": "go", "kind": None},
        {"name": "main", "language": "go", "kind": "function"},
    ]
    
    for case in test_cases:
        try:
            symbol = client.find_symbol(
                name=case["name"],
                language=case["language"],
                kind=case["kind"]
            )
            
            if symbol:
                print_success(f"找到符号: {symbol.get('name')}")
                print(f"    类型: {symbol.get('kind')}")
                print(f"    限定名: {symbol.get('qualifiedName')}")
                loc = symbol.get('location', {})
                print(f"    位置: {loc.get('path')}:{loc.get('startLine')}")
            else:
                print_warning(f"未找到符号: {case['name']}")
        except Exception as e:
            print_error(f"查找失败 {case['name']}: {e}")


def test_object_properties(client: CodeIndexClient):
    """测试查询对象属性"""
    print_test("查询对象属性（object_properties）")
    
    test_cases = [
        {"object": "GatewayConfig", "language": "go"},
        {"object": "UserService", "language": None},
    ]
    
    for case in test_cases:
        try:
            props = client.object_properties(
                object_name=case["object"],
                language=case["language"]
            )
            
            if props:
                print_success(f"找到 {len(props)} 个属性/方法: {case['object']}")
                for prop in props[:5]:  # 只显示前5个
                    sig = prop.get('signature', '')
                    if len(sig) > 50:
                        sig = sig[:50] + "..."
                    print(f"    • {prop.get('kind')} {prop.get('name')}")
                    if sig:
                        print(f"      {sig}")
            else:
                print_warning(f"未找到属性: {case['object']}（可能不存在或没有属性）")
        except Exception as e:
            print_error(f"查询失败 {case['object']}: {e}")


def test_definition(client: CodeIndexClient):
    """测试获取定义位置"""
    print_test("获取定义位置（definition）")
    
    # 先找到一个符号
    symbol = client.find_symbol(name="GatewayConfig", language="go")
    
    if not symbol or not symbol.get('symbolId'):
        print_warning("需要先找到符号才能测试定义位置")
        return
    
    try:
        location = client.definition(symbol['symbolId'])
        
        if location:
            print_success(f"定义位置: {location.get('path')}:{location.get('startLine')}")
        else:
            print_warning("未找到定义位置")
    except Exception as e:
        print_error(f"获取定义位置失败: {e}")


def test_references(client: CodeIndexClient):
    """测试获取引用"""
    print_test("获取引用（references）")
    
    # 先找到一个符号
    symbol = client.find_symbol(name="gateway", language="go")
    
    if not symbol or not symbol.get('symbolId'):
        print_warning("需要先找到符号才能测试引用")
        return
    
    try:
        refs = client.references(symbol['symbolId'])
        
        if refs:
            print_success(f"找到 {len(refs)} 个引用")
            for ref in refs[:3]:  # 只显示前3个
                print(f"    • {ref.get('path')}:{ref.get('startLine')}")
        else:
            print_warning("未找到引用")
    except Exception as e:
        print_error(f"获取引用失败: {e}")


def test_call_chain(client: CodeIndexClient):
    """测试构建调用链"""
    print_test("构建调用链（call_chain）")
    
    # 先找到一个符号
    symbol = client.find_symbol(name="StartGatewayFromConfig", language="go")
    
    if not symbol or not symbol.get('symbolId'):
        print_warning("需要先找到符号才能测试调用链")
        return
    
    try:
        chain = client.call_chain(
            from_symbol=symbol['symbolId'],
            direction="forward",
            depth=3
        )
        
        if chain:
            print_success(f"调用链: {chain.get('name')}")
            children_count = len(chain.get('children', []))
            print(f"    深度: {chain.get('depth')}, 子节点数: {children_count}")
        else:
            print_warning("未找到调用链")
    except Exception as e:
        print_error(f"构建调用链失败: {e}")


def test_config_compatibility():
    """测试配置对象兼容性"""
    print_test("配置对象兼容性（CodeIndexConfig）")
    
    try:
        config = CodeIndexConfig(
            db_path=str(TEST_DB_PATH),
            # 以下参数已废弃，但保留用于兼容性
            root_dir=str(TEST_ROOT),
            languages=["ts", "js", "go", "python"],
        )
        
        with CodeIndexClient(config) as client:
            symbols = client.find_symbols(name="CreateEnvironment", language="go")
            print_success(f"使用配置对象成功，找到 {len(symbols)} 个符号")
    except Exception as e:
        print_error(f"配置对象测试失败: {e}")


# ============================================================================
# 主测试流程
# ============================================================================

def run_all_tests():
    """运行所有测试"""
    print("\n" + "=" * 70)
    print("  CodeIndex Python SDK 测试套件")
    print("=" * 70)
    print(f"\n📁 数据库路径: {TEST_DB_PATH}")
    
    # 检查数据库是否存在
    if not check_database_exists(TEST_DB_PATH):
        sys.exit(1)
    
    # 测试连接
    client = test_connection(str(TEST_DB_PATH))
    if not client:
        sys.exit(1)
    
    try:
        # 运行所有测试用例
        print_section("基础功能测试")
        test_find_symbols(client)
        test_find_symbol(client)
        test_object_properties(client)
        
        print_section("高级功能测试")
        test_definition(client)
        test_references(client)
        test_call_chain(client)
        
        print_section("兼容性测试")
        test_config_compatibility()
        
        # 测试完成
        print_section("测试完成")
        print_success("所有测试执行完成！")
        
    except Exception as e:
        print_error(f"测试过程中发生错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        client.close()


if __name__ == "__main__":
    run_all_tests()
