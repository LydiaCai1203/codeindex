/**
 * TypeScript/JavaScript symbol and call extractor
 */

import type Parser from 'tree-sitter';
import type {
  SymbolRecord,
  CallRecord,
  ReferenceRecord,
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

export class TypeScriptExtractor {
  extract(tree: Parser.Tree, source: string, language: Language): ExtractionResult {
    const symbols: ExtractionResult['symbols'] = [];
    const calls: ExtractionResult['calls'] = [];
    const references: ExtractionResult['references'] = [];

    const rootNode = tree.rootNode;
    const sourceLines = source.split('\n');

    // Extract symbols
    this.extractSymbols(rootNode, symbols, language, sourceLines);

    // Extract calls and references
    this.extractCallsAndReferences(rootNode, calls, references, sourceLines);

    return { symbols, calls, references };
  }

  private extractSymbols(
    node: Parser.SyntaxNode,
    symbols: Omit<SymbolRecord, 'fileId' | 'symbolId'>[],
    language: Language,
    sourceLines: string[],
    scope: string = ''
  ): void {
    // Function declarations
    if (node.type === 'function_declaration' || node.type === 'function') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const name = nameNode.text;
        const qualifiedName = scope ? `${scope}.${name}` : name;
        
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
          exported: this.isExported(node),
        });

        // Recurse into function body with new scope
        const bodyNode = node.childForFieldName('body');
        if (bodyNode) {
          this.extractSymbols(bodyNode, symbols, language, sourceLines, qualifiedName);
        }
      }
    }

    // Arrow functions assigned to variables
    if (node.type === 'lexical_declaration' || node.type === 'variable_declaration') {
      for (const child of node.namedChildren) {
        if (child.type === 'variable_declarator') {
          const nameNode = child.childForFieldName('name');
          const valueNode = child.childForFieldName('value');
          
          if (nameNode && valueNode && (valueNode.type === 'arrow_function' || valueNode.type === 'function')) {
            const name = nameNode.text;
            const qualifiedName = scope ? `${scope}.${name}` : name;
            
            symbols.push({
              language,
              kind: 'function',
              name,
              qualifiedName,
              startLine: child.startPosition.row + 1,
              startCol: child.startPosition.column,
              endLine: child.endPosition.row + 1,
              endCol: child.endPosition.column,
              signature: this.extractSignature(valueNode, sourceLines),
              exported: this.isExported(node.parent),
            });
          }
        }
      }
    }

    // Class declarations
    if (node.type === 'class_declaration' || node.type === 'class') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const name = nameNode.text;
        const qualifiedName = scope ? `${scope}.${name}` : name;
        
        symbols.push({
          language,
          kind: 'class',
          name,
          qualifiedName,
          startLine: node.startPosition.row + 1,
          startCol: node.startPosition.column,
          endLine: node.endPosition.row + 1,
          endCol: node.endPosition.column,
          signature: `class ${name}`,
          exported: this.isExported(node),
        });

        // Extract class members
        const bodyNode = node.childForFieldName('body');
        if (bodyNode) {
          this.extractClassMembers(bodyNode, symbols, language, sourceLines, qualifiedName);
        }
      }
    }

    // Interface declarations (TypeScript)
    if (node.type === 'interface_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const name = nameNode.text;
        const qualifiedName = scope ? `${scope}.${name}` : name;
        
        symbols.push({
          language,
          kind: 'interface',
          name,
          qualifiedName,
          startLine: node.startPosition.row + 1,
          startCol: node.startPosition.column,
          endLine: node.endPosition.row + 1,
          endCol: node.endPosition.column,
          signature: `interface ${name}`,
          exported: this.isExported(node),
        });
      }
    }

    // Type alias declarations (TypeScript)
    if (node.type === 'type_alias_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const name = nameNode.text;
        const qualifiedName = scope ? `${scope}.${name}` : name;
        
        symbols.push({
          language,
          kind: 'type',
          name,
          qualifiedName,
          startLine: node.startPosition.row + 1,
          startCol: node.startPosition.column,
          endLine: node.endPosition.row + 1,
          endCol: node.endPosition.column,
          exported: this.isExported(node),
        });
      }
    }

    // Recurse into children
    for (const child of node.namedChildren) {
      this.extractSymbols(child, symbols, language, sourceLines, scope);
    }
  }

  private extractClassMembers(
    classBody: Parser.SyntaxNode,
    symbols: Omit<SymbolRecord, 'fileId' | 'symbolId'>[],
    language: Language,
    sourceLines: string[],
    className: string
  ): void {
    for (const member of classBody.namedChildren) {
      // Method definitions
      if (member.type === 'method_definition') {
        const nameNode = member.childForFieldName('name');
        if (nameNode) {
          const name = nameNode.text;
          const qualifiedName = `${className}.${name}`;
          
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
            exported: false,
          });
        }
      }

      // Property definitions
      if (member.type === 'field_definition' || member.type === 'public_field_definition') {
        const nameNode = member.childForFieldName('property');
        if (nameNode) {
          const name = nameNode.text;
          const qualifiedName = `${className}.${name}`;
          
          symbols.push({
            language,
            kind: 'property',
            name,
            qualifiedName,
            startLine: member.startPosition.row + 1,
            startCol: member.startPosition.column,
            endLine: member.endPosition.row + 1,
            endCol: member.endPosition.column,
            exported: false,
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
          callerName: '', // Will be resolved later based on scope
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
        parentType === 'class_declaration' ||
        parentType === 'variable_declarator' ||
        parentType === 'method_definition'
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

      // Check if it's a write
      if (parentType === 'assignment_expression') {
        const leftNode = node.parent.childForFieldName('left');
        if (leftNode === node || this.containsNode(leftNode, node)) {
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
    if (node.type === 'member_expression') {
      const property = node.childForFieldName('property');
      if (property) {
        return property.text;
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

  private isExported(node: Parser.SyntaxNode | null): boolean {
    if (!node) return false;
    
    // Check if node or its parent is an export statement
    let current: Parser.SyntaxNode | null = node;
    while (current) {
      if (
        current.type === 'export_statement' ||
        current.type === 'export_declaration' ||
        current.type.startsWith('export_')
      ) {
        return true;
      }
      current = current.parent;
    }
    
    return false;
  }
}

