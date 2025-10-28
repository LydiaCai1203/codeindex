/**
 * Java language symbol and call extractor
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

export class JavaExtractor {
  extract(tree: Parser.Tree, source: string, language: Language): ExtractionResult {
    const symbols: ExtractionResult['symbols'] = [];
    const calls: ExtractionResult['calls'] = [];
    const references: ExtractionResult['references'] = [];

    const rootNode = tree.rootNode;
    const sourceLines = source.split('\n');

    // Extract package name
    const packageName = this.extractPackageName(rootNode);

    // Extract symbols
    this.extractSymbols(rootNode, symbols, language, sourceLines, packageName);

    // Extract calls and references
    this.extractCallsAndReferences(rootNode, calls, references, sourceLines);

    return { symbols, calls, references };
  }

  private extractPackageName(rootNode: Parser.SyntaxNode): string {
    // Find package declaration
    const packageNode = rootNode.namedChildren.find(n => n.type === 'package_declaration');
    if (packageNode) {
      const scopedIdentifier = packageNode.childForFieldName('name');
      if (scopedIdentifier) {
        return this.extractScopedIdentifier(scopedIdentifier);
      }
    }
    return '';
  }

  private extractScopedIdentifier(node: Parser.SyntaxNode): string {
    const parts: string[] = [];
    let current: Parser.SyntaxNode | null = node;
    
    while (current) {
      if (current.type === 'identifier') {
        parts.unshift(current.text);
      }
      // Handle scoped_identifier which has multiple children
      if (current.type === 'scoped_identifier') {
        for (const child of current.namedChildren) {
          if (child.type === 'identifier') {
            parts.unshift(child.text);
          }
        }
        break;
      }
      current = current.namedChildren[0] || null;
    }
    
    return parts.join('.');
  }

  private extractSymbols(
    node: Parser.SyntaxNode,
    symbols: Omit<SymbolRecord, 'fileId' | 'symbolId'>[],
    language: Language,
    sourceLines: string[],
    scope: string
  ): void {
    // Class declarations
    if (node.type === 'class_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const name = nameNode.text;
        const qualifiedName = scope ? `${scope}.${name}` : name;
        const exported = this.isPublic(node);
        
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

        // Extract class body (fields, methods, constructors)
        const bodyNode = node.childForFieldName('body');
        if (bodyNode) {
          this.extractClassMembers(bodyNode, symbols, language, sourceLines, qualifiedName);
        }
      }
    }

    // Interface declarations
    if (node.type === 'interface_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const name = nameNode.text;
        const qualifiedName = scope ? `${scope}.${name}` : name;
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
          signature: `interface ${name}`,
          exported,
        });

        // Extract interface body (methods)
        const bodyNode = node.childForFieldName('body');
        if (bodyNode) {
          this.extractInterfaceMembers(bodyNode, symbols, language, sourceLines, qualifiedName);
        }
      }
    }

    // Enum declarations
    if (node.type === 'enum_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const name = nameNode.text;
        const qualifiedName = scope ? `${scope}.${name}` : name;
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

    // Method declarations (standalone methods, not in class)
    if (node.type === 'method_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const name = nameNode.text;
        const qualifiedName = scope ? `${scope}.${name}` : name;
        const exported = this.isPublic(node);
        
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

        // Recurse into method body
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

  private extractClassMembers(
    classBody: Parser.SyntaxNode,
    symbols: Omit<SymbolRecord, 'fileId' | 'symbolId'>[],
    language: Language,
    sourceLines: string[],
    className: string
  ): void {
    for (const member of classBody.namedChildren) {
      // Field declarations
      if (member.type === 'field_declaration') {
        const declarators = member.namedChildren.filter(c => c.type === 'variable_declarator');
        for (const declarator of declarators) {
          const nameNode = declarator.childForFieldName('name');
          if (nameNode) {
            const name = nameNode.text;
            const qualifiedName = `${className}.${name}`;
            const exported = this.isPublic(member);
            
            symbols.push({
              language,
              kind: 'field',
              name,
              qualifiedName,
              startLine: declarator.startPosition.row + 1,
              startCol: declarator.startPosition.column,
              endLine: declarator.endPosition.row + 1,
              endCol: declarator.endPosition.column,
              exported,
            });
          }
        }
      }

      // Method declarations
      if (member.type === 'method_declaration') {
        const nameNode = member.childForFieldName('name');
        if (nameNode) {
          const name = nameNode.text;
          const qualifiedName = `${className}.${name}`;
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

      // Constructor declarations
      if (member.type === 'constructor_declaration') {
        const nameNode = member.childForFieldName('name');
        if (nameNode) {
          const name = nameNode.text;
          const qualifiedName = `${className}.${name}`;
          const exported = this.isPublic(member);
          
          symbols.push({
            language,
            kind: 'method', // Constructors are treated as methods
            name,
            qualifiedName,
            startLine: member.startPosition.row + 1,
            startCol: member.startPosition.column,
            endLine: member.endPosition.row + 1,
            endCol: member.endPosition.column,
            signature: this.extractSignature(member, sourceLines),
            exported,
          });

          // Recurse into constructor body
          const bodyNode = member.childForFieldName('body');
          if (bodyNode) {
            this.extractSymbols(bodyNode, symbols, language, sourceLines, qualifiedName);
          }
        }
      }

      // Inner classes
      if (member.type === 'class_declaration' || member.type === 'interface_declaration' || member.type === 'enum_declaration') {
        const nameNode = member.childForFieldName('name');
        if (nameNode) {
          const name = nameNode.text;
          const qualifiedName = `${className}.${name}`;
          const exported = this.isPublic(member);
          
          let kind: SymbolKind = 'class';
          if (member.type === 'interface_declaration') {
            kind = 'interface';
          } else if (member.type === 'enum_declaration') {
            kind = 'type';
          }
          
          symbols.push({
            language,
            kind,
            name,
            qualifiedName,
            startLine: member.startPosition.row + 1,
            startCol: member.startPosition.column,
            endLine: member.endPosition.row + 1,
            endCol: member.endPosition.column,
            signature: `${kind} ${name}`,
            exported,
          });

          // Recurse into inner class/interface body
          const bodyNode = member.childForFieldName('body');
          if (bodyNode) {
            this.extractClassMembers(bodyNode, symbols, language, sourceLines, qualifiedName);
          }
        }
      }
    }
  }

  private extractInterfaceMembers(
    interfaceBody: Parser.SyntaxNode,
    symbols: Omit<SymbolRecord, 'fileId' | 'symbolId'>[],
    language: Language,
    sourceLines: string[],
    interfaceName: string
  ): void {
    for (const member of interfaceBody.namedChildren) {
      // Method declarations in interfaces
      if (member.type === 'method_declaration') {
        const nameNode = member.childForFieldName('name');
        if (nameNode) {
          const name = nameNode.text;
          const qualifiedName = `${interfaceName}.${name}`;
          const exported = true; // Interface methods are always public
          
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

      // Field declarations in interfaces (constants)
      if (member.type === 'field_declaration') {
        const declarators = member.namedChildren.filter(c => c.type === 'variable_declarator');
        for (const declarator of declarators) {
          const nameNode = declarator.childForFieldName('name');
          if (nameNode) {
            const name = nameNode.text;
            const qualifiedName = `${interfaceName}.${name}`;
            
            symbols.push({
              language,
              kind: 'constant',
              name,
              qualifiedName,
              startLine: declarator.startPosition.row + 1,
              startCol: declarator.startPosition.column,
              endLine: declarator.endPosition.row + 1,
              endCol: declarator.endPosition.column,
              exported: true, // Interface fields are always public static final
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
    // Method invocations
    if (node.type === 'method_invocation') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const calleeName = nameNode.text;
        
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
          startLine: nameNode.startPosition.row + 1,
          startCol: nameNode.startPosition.column,
          endLine: nameNode.endPosition.row + 1,
          endCol: nameNode.endPosition.column,
        });
      }
    }

    // Object creation expressions (new ClassName())
    if (node.type === 'object_creation_expression') {
      const typeNode = node.childForFieldName('type');
      if (typeNode) {
        const calleeName = this.extractTypeName(typeNode);
        
        calls.push({
          callerName: '',
          calleeName, // Constructor call
          siteStartLine: node.startPosition.row + 1,
          siteStartCol: node.startPosition.column,
          siteEndLine: node.endPosition.row + 1,
          siteEndCol: node.endPosition.column,
        });

        references.push({
          name: calleeName,
          refKind: 'call',
          startLine: node.startPosition.row + 1,
          startCol: node.startPosition.column,
          endLine: node.endPosition.row + 1,
          endCol: node.endPosition.column,
        });
      }
    }

    // Identifier references
    if (node.type === 'identifier' && node.parent) {
      const parentType = node.parent.type;
      
      // Skip if it's a definition
      if (
        parentType === 'class_declaration' ||
        parentType === 'interface_declaration' ||
        parentType === 'enum_declaration' ||
        parentType === 'method_declaration' ||
        parentType === 'constructor_declaration' ||
        parentType === 'field_declaration' ||
        parentType === 'variable_declarator' ||
        parentType === 'local_variable_declaration' ||
        parentType === 'formal_parameter'
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

  private extractTypeName(typeNode: Parser.SyntaxNode): string {
    if (typeNode.type === 'type_identifier') {
      return typeNode.text;
    }
    if (typeNode.type === 'scoped_type_identifier') {
      return this.extractScopedIdentifier(typeNode);
    }
    // Handle generic types like List<String>
    if (typeNode.type === 'generic_type') {
      const typeIdentifier = typeNode.childForFieldName('type');
      if (typeIdentifier) {
        return this.extractTypeName(typeIdentifier);
      }
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
    // Check for public modifier
    for (const child of node.namedChildren) {
      if (child.type === 'modifiers') {
        for (const modifier of child.namedChildren) {
          if (modifier.type === 'modifier' && modifier.text === 'public') {
            return true;
          }
        }
      }
      // Sometimes modifier is directly a child
      if (child.type === 'modifier' && child.text === 'public') {
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

