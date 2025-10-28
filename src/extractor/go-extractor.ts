/**
 * Go language symbol and call extractor
 */

import type Parser from 'tree-sitter';
import type {
  SymbolRecord,
  Language,
  SymbolKind,
  ReferenceKind,
} from '../core/types.js';

export interface ExtractionResult {
  symbols: Omit<SymbolRecord, 'fileId' | 'symbolId'>[];
  calls: Array<{
    callerName: string;
    calleeName: string;
    siteStartLine: number;
    siteStartCol: number;
    siteEndLine: number;
    siteEndCol: number;
  }>;
  references: Array<{
    name: string;
    refKind: ReferenceKind;
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
  }>;
}

export class GoExtractor {
  private maxNestedStructDepth: number = 3; // 默认最大深度为 3

  constructor(maxNestedStructDepth?: number) {
    if (maxNestedStructDepth !== undefined && maxNestedStructDepth >= 0) {
      this.maxNestedStructDepth = maxNestedStructDepth;
    }
  }

  extract(tree: Parser.Tree, source: string, language: Language): ExtractionResult {
    const symbols: ExtractionResult['symbols'] = [];
    const calls: ExtractionResult['calls'] = [];
    const references: ExtractionResult['references'] = [];

    const rootNode = tree.rootNode;
    const sourceLines = source.split('\n');

    // Extract package name
    const packageNode = rootNode.children.find(n => n.type === 'package_clause');
    let packageName = 'main';
    if (packageNode) {
      const nameNode = packageNode.childForFieldName('name');
      if (nameNode) {
        packageName = nameNode.text;
      }
    }

    // Extract symbols
    this.extractSymbols(rootNode, symbols, language, sourceLines, packageName);

    // Extract calls and references
    this.extractCallsAndReferences(rootNode, calls, references, sourceLines);

    return { symbols, calls, references };
  }

  private extractSymbols(
    node: Parser.SyntaxNode,
    symbols: Omit<SymbolRecord, 'fileId' | 'symbolId'>[],
    language: Language,
    sourceLines: string[],
    scope: string
  ): void {
    // Function declarations
    if (node.type === 'function_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const name = nameNode.text;
        const qualifiedName = scope ? `${scope}.${name}` : name;
        
        // Check if it's exported (starts with uppercase in Go)
        const exported = name.length > 0 && name[0] === name[0].toUpperCase();
        
        symbols.push({
          language,
          kind: 'function',
          name,
          qualifiedName,
          startLine: node.startPosition.row + 1,
          startCol: node.startPosition.column,
          endLine: node.endPosition.row + 1,
          endCol: node.endPosition.column,
          signature: this.extractSignature(node, sourceLines),
          exported,
        });
      }
    }

    // Method declarations
    if (node.type === 'method_declaration') {
      const nameNode = node.childForFieldName('name');
      const receiverNode = node.childForFieldName('receiver');
      
      if (nameNode && receiverNode) {
        const name = nameNode.text;
        const receiverType = this.extractReceiverType(receiverNode);
        const qualifiedName = receiverType ? `${scope}.${receiverType}.${name}` : `${scope}.${name}`;
        
        const exported = name.length > 0 && name[0] === name[0].toUpperCase();
        
        symbols.push({
          language,
          kind: 'method',
          name,
          qualifiedName,
          startLine: node.startPosition.row + 1,
          startCol: node.startPosition.column,
          endLine: node.endPosition.row + 1,
          endCol: node.endPosition.column,
          signature: this.extractSignature(node, sourceLines),
          exported,
        });
      }
    }

    // Type declarations (struct, interface)
    if (node.type === 'type_declaration') {
      // type_declaration contains type_spec as named children
      for (const child of node.namedChildren) {
        if (child.type === 'type_spec') {
          const nameNode = child.childForFieldName('name');
          const typeNode = child.childForFieldName('type');
          
          if (nameNode && typeNode) {
            const name = nameNode.text;
            const qualifiedName = scope ? `${scope}.${name}` : name;
            const exported = name.length > 0 && name[0] === name[0].toUpperCase();
            
            let kind: SymbolKind = 'type';
            if (typeNode.type === 'struct_type') {
              kind = 'struct'; // Use 'struct' for Go structs
            } else if (typeNode.type === 'interface_type') {
              kind = 'interface';
            }
            
            symbols.push({
              language,
              kind,
              name,
              qualifiedName,
              startLine: child.startPosition.row + 1,
              startCol: child.startPosition.column,
              endLine: child.endPosition.row + 1,
              endCol: child.endPosition.column,
              signature: `type ${name}`,
              exported,
            });

            // Extract struct fields
            if (typeNode.type === 'struct_type') {
              this.extractStructFields(typeNode, symbols, language, sourceLines, qualifiedName, 0);
            }
            
            // Extract interface methods
            if (typeNode.type === 'interface_type') {
              this.extractInterfaceMethods(typeNode, symbols, language, sourceLines, qualifiedName);
            }
          }
        }
      }
    }

    // Variable/constant declarations
    if (node.type === 'var_declaration' || node.type === 'const_declaration') {
      const specs = node.children.filter(c => c.type === 'var_spec' || c.type === 'const_spec');
      
      for (const spec of specs) {
        const nameNode = spec.childForFieldName('name');
        if (nameNode) {
          const name = nameNode.text;
          const qualifiedName = scope ? `${scope}.${name}` : name;
          const exported = name.length > 0 && name[0] === name[0].toUpperCase();
          
          symbols.push({
            language,
            kind: node.type === 'const_declaration' ? 'constant' : 'variable',
            name,
            qualifiedName,
            startLine: spec.startPosition.row + 1,
            startCol: spec.startPosition.column,
            endLine: spec.endPosition.row + 1,
            endCol: spec.endPosition.column,
            exported,
          });
        }
      }
    }

    // Recurse into children
    for (const child of node.namedChildren) {
      this.extractSymbols(child, symbols, language, sourceLines, scope);
    }
  }

  private extractStructFields(
    structNode: Parser.SyntaxNode,
    symbols: Omit<SymbolRecord, 'fileId' | 'symbolId'>[],
    language: Language,
    sourceLines: string[],
    structName: string,
    currentDepth: number = 0
  ): void {
    // struct_type contains field_declaration_list as a child
    const fieldList = structNode.namedChildren.find(c => c.type === 'field_declaration_list');
    if (!fieldList) return;

    for (const field of fieldList.namedChildren) {
      if (field.type === 'field_declaration') {
        const nameNode = field.childForFieldName('name');
        const typeNode = field.childForFieldName('type');
        
        if (nameNode) {
          const name = nameNode.text;
          const qualifiedName = `${structName}.${name}`;
          const exported = name.length > 0 && name[0] === name[0].toUpperCase();
          
          // 提取类型信息
          const fieldType = typeNode ? typeNode.text : '';
          
          symbols.push({
            language,
            kind: 'field',
            name,
            qualifiedName,
            startLine: field.startPosition.row + 1,
            startCol: field.startPosition.column,
            endLine: field.endPosition.row + 1,
            endCol: field.endPosition.column,
            signature: fieldType ? `${name} ${fieldType}` : undefined,
            exported,
          });

          // 递归处理匿名嵌套结构体
          if (typeNode && typeNode.type === 'struct_type' && currentDepth < this.maxNestedStructDepth) {
            this.extractStructFields(typeNode, symbols, language, sourceLines, qualifiedName, currentDepth + 1);
          }
        } else if (!nameNode && typeNode) {
          // 处理嵌入字段（embedded field）
          // 例如: type Employee struct { Person; Company string }
          const embeddedName = typeNode.text;
          const qualifiedName = `${structName}.${embeddedName}`;
          const exported = embeddedName.length > 0 && embeddedName[0] === embeddedName[0].toUpperCase();
          
          symbols.push({
            language,
            kind: 'field',
            name: embeddedName,
            qualifiedName,
            startLine: field.startPosition.row + 1,
            startCol: field.startPosition.column,
            endLine: field.endPosition.row + 1,
            endCol: field.endPosition.column,
            exported,
          });
        }
      }
    }
  }

  private extractInterfaceMethods(
    interfaceNode: Parser.SyntaxNode,
    symbols: Omit<SymbolRecord, 'fileId' | 'symbolId'>[],
    language: Language,
    sourceLines: string[],
    interfaceName: string
  ): void {
    // interface_type contains method_elem as named children
    for (const child of interfaceNode.namedChildren) {
      if (child.type === 'method_elem') {
        const nameNode = child.childForFieldName('name');
        if (nameNode) {
          const name = nameNode.text;
          const qualifiedName = `${interfaceName}.${name}`;
          const exported = name.length > 0 && name[0] === name[0].toUpperCase();
          
          symbols.push({
            language,
            kind: 'method',
            name,
            qualifiedName,
            startLine: child.startPosition.row + 1,
            startCol: child.startPosition.column,
            endLine: child.endPosition.row + 1,
            endCol: child.endPosition.column,
            signature: this.extractSignature(child, sourceLines),
            exported,
          });
        }
      }
    }
  }

  private extractCallsAndReferences(
    node: Parser.SyntaxNode,
    calls: Array<{
      callerName: string;
      calleeName: string;
      siteStartLine: number;
      siteStartCol: number;
      siteEndLine: number;
      siteEndCol: number;
    }>,
    references: Array<{
      name: string;
      refKind: ReferenceKind;
      startLine: number;
      startCol: number;
      endLine: number;
      endCol: number;
    }>,
    sourceLines: string[]
  ): void {
    // Call expressions
    if (node.type === 'call_expression') {
      const functionNode = node.childForFieldName('function');
      if (functionNode) {
        const calleeName = this.extractCalleeName(functionNode);
        
        calls.push({
          callerName: '', // Will be resolved later
          calleeName,
          siteStartLine: node.startPosition.row + 1,
          siteStartCol: node.startPosition.column,
          siteEndLine: node.endPosition.row + 1,
          siteEndCol: node.endPosition.column,
        });

        references.push({
          name: calleeName,
          refKind: 'call',
          startLine: functionNode.startPosition.row + 1,
          startCol: functionNode.startPosition.column,
          endLine: functionNode.endPosition.row + 1,
          endCol: functionNode.endPosition.column,
        });
      }
    }

    // Identifier references
    if (node.type === 'identifier' && node.parent) {
      const parentType = node.parent.type;
      
      // Skip if it's a definition
      if (
        parentType === 'function_declaration' ||
        parentType === 'method_declaration' ||
        parentType === 'type_spec' ||
        parentType === 'field_declaration' ||
        parentType === 'var_spec' ||
        parentType === 'const_spec'
      ) {
        const nameField = node.parent.childForFieldName('name');
        if (nameField === node) {
          // This is a definition, not a reference
          return;
        }
      }

      // It's a reference
      const name = node.text;
      let refKind: ReferenceKind = 'read';

      // Check if it's a write (left side of assignment)
      if (parentType === 'assignment_statement') {
        const leftNodes = node.parent.childForFieldName('left');
        if (leftNodes && this.containsNode(leftNodes, node)) {
          refKind = 'write';
        }
      }

      references.push({
        name,
        refKind,
        startLine: node.startPosition.row + 1,
        startCol: node.startPosition.column,
        endLine: node.endPosition.row + 1,
        endCol: node.endPosition.column,
      });
    }

    // Recurse into children
    for (const child of node.namedChildren) {
      this.extractCallsAndReferences(child, calls, references, sourceLines);
    }
  }

  private extractReceiverType(receiverNode: Parser.SyntaxNode): string {
    // receiver is typically (parameterList) with type inside
    const paramList = receiverNode.namedChildren[0];
    if (paramList && paramList.type === 'parameter_declaration') {
      const typeNode = paramList.childForFieldName('type');
      if (typeNode) {
        // Handle pointer types like *MyStruct
        if (typeNode.type === 'pointer_type') {
          const innerType = typeNode.namedChildren[0];
          return innerType ? innerType.text : typeNode.text;
        }
        return typeNode.text;
      }
    }
    return '';
  }

  private extractCalleeName(node: Parser.SyntaxNode): string {
    if (node.type === 'identifier') {
      return node.text;
    }
    if (node.type === 'selector_expression') {
      const field = node.childForFieldName('field');
      if (field) {
        return field.text;
      }
    }
    return node.text;
  }

  private containsNode(parent: Parser.SyntaxNode | null, target: Parser.SyntaxNode): boolean {
    if (!parent) return false;
    if (parent === target) return true;
    
    for (const child of parent.namedChildren) {
      if (this.containsNode(child, target)) {
        return true;
      }
    }
    return false;
  }

  private extractSignature(node: Parser.SyntaxNode, sourceLines: string[]): string {
    // Get first line of the node for signature
    const startLine = node.startPosition.row;
    const endLine = Math.min(node.endPosition.row, startLine + 2); // Max 3 lines
    
    let signature = '';
    for (let i = startLine; i <= endLine && i < sourceLines.length; i++) {
      signature += sourceLines[i] + '\n';
    }
    
    return signature.trim().slice(0, 200); // Limit to 200 chars
  }
}

