/**
 * Rust language symbol and call extractor
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

export class RustExtractor {
  extract(tree: Parser.Tree, source: string, language: Language): ExtractionResult {
    const symbols: ExtractionResult['symbols'] = [];
    const calls: ExtractionResult['calls'] = [];
    const references: ExtractionResult['references'] = [];

    const rootNode = tree.rootNode;
    const sourceLines = source.split('\n');

    // Extract module name (if any)
    // Rust modules can be declared with `mod name { ... }`
    const moduleName = this.extractModuleName(rootNode);

    // Extract symbols
    this.extractSymbols(rootNode, symbols, language, sourceLines, moduleName);

    // Extract calls and references
    this.extractCallsAndReferences(rootNode, calls, references, sourceLines);

    return { symbols, calls, references };
  }

  private extractModuleName(rootNode: Parser.SyntaxNode): string {
    // Try to find module declaration
    const modNode = rootNode.namedChildren.find(n => n.type === 'mod_item');
    if (modNode) {
      const nameNode = modNode.childForFieldName('name');
      if (nameNode) {
        return nameNode.text;
      }
    }
    return '';
  }

  private extractSymbols(
    node: Parser.SyntaxNode,
    symbols: Omit<SymbolRecord, 'fileId' | 'symbolId'>[],
    language: Language,
    sourceLines: string[],
    scope: string
  ): void {
    // Function declarations
    if (node.type === 'function_item') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const name = nameNode.text;
        const qualifiedName = scope ? `${scope}::${name}` : name;
        
        // Check if it's public (has `pub` keyword)
        const exported = this.isPublic(node);
        
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

        // Recurse into function body with new scope
        const bodyNode = node.childForFieldName('body');
        if (bodyNode) {
          this.extractSymbols(bodyNode, symbols, language, sourceLines, qualifiedName);
        }
      }
    }

    // Struct declarations
    if (node.type === 'struct_item') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const name = nameNode.text;
        const qualifiedName = scope ? `${scope}::${name}` : name;
        const exported = this.isPublic(node);
        
        symbols.push({
          language,
          kind: 'struct',
          name,
          qualifiedName,
          startLine: node.startPosition.row + 1,
          startCol: node.startPosition.column,
          endLine: node.endPosition.row + 1,
          endCol: node.endPosition.column,
          signature: `struct ${name}`,
          exported,
        });

        // Extract struct fields
        const bodyNode = node.childForFieldName('body');
        if (bodyNode) {
          this.extractStructFields(bodyNode, symbols, language, sourceLines, qualifiedName);
        }
      }
    }

    // Enum declarations
    if (node.type === 'enum_item') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const name = nameNode.text;
        const qualifiedName = scope ? `${scope}::${name}` : name;
        const exported = this.isPublic(node);
        
        symbols.push({
          language,
          kind: 'type',
          name,
          qualifiedName,
          startLine: node.startPosition.row + 1,
          startCol: node.startPosition.column,
          endLine: node.endPosition.row + 1,
          endCol: node.endPosition.column,
          signature: `enum ${name}`,
          exported,
        });
      }
    }

    // Trait declarations
    if (node.type === 'trait_item') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const name = nameNode.text;
        const qualifiedName = scope ? `${scope}::${name}` : name;
        const exported = this.isPublic(node);
        
        symbols.push({
          language,
          kind: 'interface',
          name,
          qualifiedName,
          startLine: node.startPosition.row + 1,
          startCol: node.startPosition.column,
          endLine: node.endPosition.row + 1,
          endCol: node.endPosition.column,
          signature: `trait ${name}`,
          exported,
        });

        // Extract trait methods
        const bodyNode = node.childForFieldName('body');
        if (bodyNode) {
          this.extractTraitMethods(bodyNode, symbols, language, sourceLines, qualifiedName);
        }
      }
    }

    // Impl blocks
    if (node.type === 'impl_item') {
      const traitNode = node.childForFieldName('trait');
      const typeNode = node.childForFieldName('type');
      
      if (typeNode) {
        const typeName = this.extractTypeName(typeNode);
        const implScope = scope ? `${scope}::${typeName}` : typeName;
        
        // Extract methods in impl block
        const bodyNode = node.childForFieldName('body');
        if (bodyNode) {
          this.extractImplMethods(bodyNode, symbols, language, sourceLines, implScope, typeName);
        }
      }
    }

    // Constant declarations
    if (node.type === 'const_item') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const name = nameNode.text;
        const qualifiedName = scope ? `${scope}::${name}` : name;
        const exported = this.isPublic(node);
        
        symbols.push({
          language,
          kind: 'constant',
          name,
          qualifiedName,
          startLine: node.startPosition.row + 1,
          startCol: node.startPosition.column,
          endLine: node.endPosition.row + 1,
          endCol: node.endPosition.column,
          exported,
        });
      }
    }

    // Static variable declarations
    if (node.type === 'static_item') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const name = nameNode.text;
        const qualifiedName = scope ? `${scope}::${name}` : name;
        const exported = this.isPublic(node);
        
        symbols.push({
          language,
          kind: 'variable',
          name,
          qualifiedName,
          startLine: node.startPosition.row + 1,
          startCol: node.startPosition.column,
          endLine: node.endPosition.row + 1,
          endCol: node.endPosition.column,
          exported,
        });
      }
    }

    // Module declarations
    if (node.type === 'mod_item') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const name = nameNode.text;
        const qualifiedName = scope ? `${scope}::${name}` : name;
        const exported = this.isPublic(node);
        
        symbols.push({
          language,
          kind: 'module',
          name,
          qualifiedName,
          startLine: node.startPosition.row + 1,
          startCol: node.startPosition.column,
          endLine: node.endPosition.row + 1,
          endCol: node.endPosition.column,
          exported,
        });

        // Recurse into module body
        const bodyNode = node.childForFieldName('body');
        if (bodyNode) {
          this.extractSymbols(bodyNode, symbols, language, sourceLines, qualifiedName);
        }
      }
    }

    // Recurse into children
    for (const child of node.namedChildren) {
      this.extractSymbols(child, symbols, language, sourceLines, scope);
    }
  }

  private extractStructFields(
    structBody: Parser.SyntaxNode,
    symbols: Omit<SymbolRecord, 'fileId' | 'symbolId'>[],
    language: Language,
    sourceLines: string[],
    structName: string
  ): void {
    for (const field of structBody.namedChildren) {
      if (field.type === 'field_declaration') {
        const nameNode = field.childForFieldName('name');
        const typeNode = field.childForFieldName('type');
        
        if (nameNode) {
          const name = nameNode.text;
          const qualifiedName = `${structName}.${name}`;
          const exported = this.isPublic(field);
          
          symbols.push({
            language,
            kind: 'field',
            name,
            qualifiedName,
            startLine: field.startPosition.row + 1,
            startCol: field.startPosition.column,
            endLine: field.endPosition.row + 1,
            endCol: field.endPosition.column,
            signature: typeNode ? typeNode.text : undefined,
            exported,
          });
        }
      }
    }
  }

  private extractTraitMethods(
    traitBody: Parser.SyntaxNode,
    symbols: Omit<SymbolRecord, 'fileId' | 'symbolId'>[],
    language: Language,
    sourceLines: string[],
    traitName: string
  ): void {
    for (const member of traitBody.namedChildren) {
      if (member.type === 'function_item' || member.type === 'function_signature_item') {
        const nameNode = member.childForFieldName('name');
        if (nameNode) {
          const name = nameNode.text;
          const qualifiedName = `${traitName}.${name}`;
          const exported = this.isPublic(member);
          
          symbols.push({
            language,
            kind: 'method',
            name,
            qualifiedName,
            startLine: member.startPosition.row + 1,
            startCol: member.startPosition.column,
            endLine: member.endPosition.row + 1,
            endCol: member.endPosition.column,
            signature: this.extractSignature(member, sourceLines),
            exported,
          });
        }
      }
    }
  }

  private extractImplMethods(
    implBody: Parser.SyntaxNode,
    symbols: Omit<SymbolRecord, 'fileId' | 'symbolId'>[],
    language: Language,
    sourceLines: string[],
    implScope: string,
    typeName: string
  ): void {
    for (const member of implBody.namedChildren) {
      if (member.type === 'function_item') {
        const nameNode = member.childForFieldName('name');
        if (nameNode) {
          const name = nameNode.text;
          const qualifiedName = `${implScope}::${name}`;
          const exported = this.isPublic(member);
          
          symbols.push({
            language,
            kind: 'method',
            name,
            qualifiedName,
            startLine: member.startPosition.row + 1,
            startCol: member.startPosition.column,
            endLine: member.endPosition.row + 1,
            endCol: member.endPosition.column,
            signature: this.extractSignature(member, sourceLines),
            exported,
          });

          // Recurse into method body
          const bodyNode = member.childForFieldName('body');
          if (bodyNode) {
            this.extractSymbols(bodyNode, symbols, language, sourceLines, qualifiedName);
          }
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
        parentType === 'function_item' ||
        parentType === 'struct_item' ||
        parentType === 'enum_item' ||
        parentType === 'trait_item' ||
        parentType === 'const_item' ||
        parentType === 'static_item' ||
        parentType === 'field_declaration' ||
        parentType === 'parameter' ||
        parentType === 'let_binding'
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
      if (parentType === 'assignment_expression') {
        const leftNode = node.parent.childForFieldName('left');
        if (leftNode && this.containsNode(leftNode, node)) {
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

  private extractCalleeName(node: Parser.SyntaxNode): string {
    if (node.type === 'identifier') {
      return node.text;
    }
    if (node.type === 'field_expression') {
      const fieldNode = node.childForFieldName('field');
      if (fieldNode) {
        return fieldNode.text;
      }
    }
    if (node.type === 'scoped_identifier') {
      // Handle paths like `std::io::stdout`
      const pathParts: string[] = [];
      let current: Parser.SyntaxNode | null = node;
      while (current) {
        if (current.type === 'identifier') {
          pathParts.unshift(current.text);
        }
        current = current.namedChildren[current.namedChildren.length - 1] || null;
      }
      return pathParts.join('::');
    }
    return node.text;
  }

  private extractTypeName(typeNode: Parser.SyntaxNode): string {
    if (typeNode.type === 'type_identifier') {
      return typeNode.text;
    }
    if (typeNode.type === 'scoped_type_identifier') {
      const pathParts: string[] = [];
      let current: Parser.SyntaxNode | null = typeNode;
      while (current) {
        if (current.type === 'type_identifier') {
          pathParts.unshift(current.text);
        }
        current = current.namedChildren[current.namedChildren.length - 1] || null;
      }
      return pathParts.join('::');
    }
    return typeNode.text;
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

  private isPublic(node: Parser.SyntaxNode): boolean {
    // Check if node has `pub` keyword as a child
    for (const child of node.children) {
      if (child.type === 'visibility_modifier' || child.text === 'pub') {
        return true;
      }
    }
    return false;
  }

  private extractSignature(node: Parser.SyntaxNode, sourceLines: string[]): string {
    // Get first few lines of the node for signature
    const startLine = node.startPosition.row;
    const endLine = Math.min(node.endPosition.row, startLine + 2); // Max 3 lines
    
    let signature = '';
    for (let i = startLine; i <= endLine && i < sourceLines.length; i++) {
      signature += sourceLines[i] + '\n';
    }
    
    return signature.trim().slice(0, 200); // Limit to 200 chars
  }
}

