/**
 * Python language symbol and call extractor
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

export class PythonExtractor {
  extract(tree: Parser.Tree, source: string, language: Language): ExtractionResult {
    const symbols: ExtractionResult['symbols'] = [];
    const calls: ExtractionResult['calls'] = [];
    const references: ExtractionResult['references'] = [];

    const rootNode = tree.rootNode;
    const sourceLines = source.split('\n');

    // Extract symbols
    this.extractSymbols(rootNode, symbols, language, sourceLines, '');

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
    // Function definitions
    if (node.type === 'function_definition') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const name = nameNode.text;
        const qualifiedName = scope ? `${scope}.${name}` : name;
        
        // Check if it's a private function (starts with _)
        const exported = !name.startsWith('_');
        
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

    // Class definitions
    if (node.type === 'class_definition') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const name = nameNode.text;
        const qualifiedName = scope ? `${scope}.${name}` : name;
        const exported = !name.startsWith('_');
        
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
          exported,
        });

        // Extract class members
        const bodyNode = node.childForFieldName('body');
        if (bodyNode) {
          this.extractClassMembers(bodyNode, symbols, language, sourceLines, qualifiedName);
        }
      }
    }

    // Assignment statements (for module-level variables)
    if (node.type === 'assignment' && this.isModuleLevel(node)) {
      const leftNode = node.childForFieldName('left');
      if (leftNode && leftNode.type === 'identifier') {
        const name = leftNode.text;
        const qualifiedName = scope ? `${scope}.${name}` : name;
        const exported = !name.startsWith('_');
        
        // Check if it's a constant (ALL_CAPS)
        const isConstant = name === name.toUpperCase() && name.includes('_');
        
        symbols.push({
          language,
          kind: isConstant ? 'constant' : 'variable',
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

    // Decorated definitions (decorators like @property, @staticmethod)
    if (node.type === 'decorated_definition') {
      const defNode = node.children.find(c => 
        c.type === 'function_definition' || c.type === 'class_definition'
      );
      if (defNode) {
        this.extractSymbols(defNode, symbols, language, sourceLines, scope);
        return; // Don't recurse again
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
      if (member.type === 'function_definition') {
        const nameNode = member.childForFieldName('name');
        if (nameNode) {
          const name = nameNode.text;
          const qualifiedName = `${className}.${name}`;
          const exported = !name.startsWith('_');
          
          // Check if it's a special method (__init__, __str__, etc.)
          const isSpecial = name.startsWith('__') && name.endsWith('__');
          
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
            exported: exported || isSpecial, // Special methods are considered exported
          });
        }
      }

      // Decorated definitions (properties, etc.)
      if (member.type === 'decorated_definition') {
        const defNode = member.children.find(c => c.type === 'function_definition');
        if (defNode) {
          const nameNode = defNode.childForFieldName('name');
          if (nameNode) {
            const name = nameNode.text;
            const qualifiedName = `${className}.${name}`;
            const exported = !name.startsWith('_');
            
            // Check if it's a property decorator
            const decorators = member.children.filter(c => c.type === 'decorator');
            const isProperty = decorators.some(d => d.text.includes('@property'));
            
            symbols.push({
              language,
              kind: isProperty ? 'property' : 'method',
              name,
              qualifiedName,
              startLine: defNode.startPosition.row + 1,
              startCol: defNode.startPosition.column,
              endLine: defNode.endPosition.row + 1,
              endCol: defNode.endPosition.column,
              signature: this.extractSignature(defNode, sourceLines),
              exported,
            });
          }
        }
      }

      // Assignment statements in class (class variables)
      if (member.type === 'expression_statement') {
        const assign = member.children.find(c => c.type === 'assignment');
        if (assign) {
          const leftNode = assign.childForFieldName('left');
          if (leftNode && leftNode.type === 'identifier') {
            const name = leftNode.text;
            const qualifiedName = `${className}.${name}`;
            const exported = !name.startsWith('_');
            
            symbols.push({
              language,
              kind: 'property',
              name,
              qualifiedName,
              startLine: assign.startPosition.row + 1,
              startCol: assign.startPosition.column,
              endLine: assign.endPosition.row + 1,
              endCol: assign.endPosition.column,
              exported,
            });
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
    if (node.type === 'call') {
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
        parentType === 'function_definition' ||
        parentType === 'class_definition' ||
        parentType === 'parameter'
      ) {
        const nameField = node.parent.childForFieldName('name');
        if (nameField === node) {
          // This is a definition, not a reference
          return;
        }
      }

      // Skip if it's the left side of an assignment at definition
      if (parentType === 'assignment') {
        const leftNode = node.parent.childForFieldName('left');
        if (leftNode === node) {
          // Check if this is a new definition or a reassignment
          if (this.isModuleLevel(node.parent)) {
            return; // Module-level assignment is a definition
          }
        }
      }

      // It's a reference
      const name = node.text;
      let refKind: ReferenceKind = 'read';

      // Check if it's a write (left side of assignment)
      if (parentType === 'assignment') {
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
    if (node.type === 'attribute') {
      const attr = node.childForFieldName('attribute');
      if (attr) {
        return attr.text;
      }
    }
    return node.text;
  }

  private isModuleLevel(node: Parser.SyntaxNode): boolean {
    let current = node.parent;
    while (current) {
      if (current.type === 'function_definition' || current.type === 'class_definition') {
        return false;
      }
      if (current.type === 'module') {
        return true;
      }
      current = current.parent;
    }
    return true;
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

