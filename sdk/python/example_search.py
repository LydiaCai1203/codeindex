#!/usr/bin/env python3
"""
示例：使用自然语言查询代码

用法：
    python example_search.py "用户登录验证" --top-k 5
"""

import argparse
import sys
from pathlib import Path

try:
    from codeindex import CodeIndexClient
except ImportError:
    print("错误：请先安装 codeindex SDK")
    print("pip install -e .")
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="使用自然语言查询代码")
    parser.add_argument("query", help="查询文本，例如：用户登录验证")
    parser.add_argument("--db", default=".codeindex/project.db", help="数据库路径")
    parser.add_argument("--top-k", type=int, default=5, help="返回结果数量")
    parser.add_argument("--lang", help="语言过滤器，例如：go, ts, python")
    parser.add_argument("--kind", help="符号类型过滤器，例如：function, class")
    parser.add_argument("--min-similarity", type=float, default=0.7, help="最小相似度阈值")
    parser.add_argument(
        "--api-endpoint",
        help="Embedding API 端点（可选，将从配置文件读取）"
    )
    parser.add_argument(
        "--api-key",
        help="Embedding API 密钥（可选，将从配置文件读取）"
    )
    parser.add_argument(
        "--model",
        help="Embedding 模型名称（可选，将从配置文件读取）"
    )
    
    args = parser.parse_args()
    
    # 检查数据库是否存在
    db_path = Path(args.db)
    if not db_path.exists():
        print(f"错误：数据库文件不存在: {db_path}")
        print("\n提示：请先使用 CodeIndex CLI 构建索引：")
        print(f"  node dist/cli/index.js index --db {args.db}")
        sys.exit(1)
    
    try:
        # 创建客户端
        client = CodeIndexClient(str(db_path))
        client.start()
        
        print(f'🔍 搜索: "{args.query}"\n')
        
        # 准备参数
        search_kwargs = {
            "query": args.query,
            "top_k": args.top_k,
            "min_similarity": args.min_similarity,
        }
        
        if args.lang:
            search_kwargs["language"] = args.lang
        if args.kind:
            search_kwargs["kind"] = args.kind
        if args.api_endpoint:
            search_kwargs["api_endpoint"] = args.api_endpoint
        if args.api_key:
            search_kwargs["api_key"] = args.api_key
        if args.model:
            search_kwargs["model"] = args.model
        
        # 执行搜索
        results = client.semantic_search(**search_kwargs)
        
        # 显示结果
        if not results:
            print("未找到结果。")
            print("\n提示：")
            print("1. 确保已使用 CLI 生成 embedding：")
            print(f"   node dist/cli/index.js embed --db {args.db}")
            print("2. 检查 min_similarity 阈值是否过高（尝试降低到 0.5）")
            print("3. 确保已正确配置 embedding API（配置文件或环境变量）")
        else:
            print(f"找到 {len(results)} 个结果：\n")
            for idx, result in enumerate(results, 1):
                symbol = result['symbol']
                print(f"{idx}. {symbol['kind']} {symbol['qualifiedName']}")
                print(f"   相似度: {result['similarity']:.1%}")
                print(f"   位置: {result['location']['path']}:{result['location']['startLine']}")
                if symbol.get('chunkSummary'):
                    summary = symbol['chunkSummary']
                    if len(summary) > 100:
                        summary = summary[:100] + "..."
                    print(f"   摘要: {summary}")
                print()
        
        client.close()
        
    except ValueError as e:
        print(f"错误: {e}")
        print("\n提示：请确保已配置 embedding API：")
        print("1. 在 codeindex.config.json 中配置 embedding 部分")
        print("2. 或设置环境变量 CODEINDEX_EMBEDDING_API_ENDPOINT 和 CODEINDEX_EMBEDDING_API_KEY")
        print("3. 或在命令行中使用 --api-endpoint 和 --api-key 参数")
        sys.exit(1)
    except Exception as e:
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

