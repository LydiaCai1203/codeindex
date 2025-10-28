/**
 * HTML language symbol and call extractor
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

export class HtmlExtractor {
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
    sourceLines: string[]
  ): void {
    // Extract elements with id attributes
    if (node.type === 'element') {
      const startTag = node.childForFieldName('start_tag');
      if (startTag) {
        const tagName = startTag.childForFieldName('name');
        const tagNameText = tagName ? tagName.text : 'unknown';
        
        // Extract id attribute
        const idAttr = this.findAttribute(startTag, 'id');
        if (idAttr) {
          const idValue = this.extractAttributeValue(idAttr);
          if (idValue) {
            symbols.push({
              language,
              kind: 'variable',
              name: idValue,
              qualifiedName: `#${idValue}`,
              startLine: idAttr.startPosition.row + 1,
              startCol: idAttr.startPosition.column,
              endLine: idAttr.endPosition.row + 1,
              endCol: idAttr.endPosition.column,
              exported: true, // IDs are globally accessible
            });
          }
        }

        // Extract class attributes (each class is a symbol)
        const classAttr = this.findAttribute(startTag, 'class');
        if (classAttr) {
          const classValues = this.extractClassValues(classAttr);
          for (const className of classValues) {
            symbols.push({
              language,
              kind: 'variable',
              name: className,
              qualifiedName: `.${className}`,
              startLine: classAttr.startPosition.row + 1,
              startCol: classAttr.startPosition.column,
              endLine: classAttr.endPosition.row + 1,
              endCol: classAttr.endPosition.column,
              exported: true,
            });
          }
        }

        // Extract custom elements/components (non-standard HTML tags)
        if (!this.isStandardHtmlTag(tagNameText)) {
          symbols.push({
            language,
            kind: 'class', // Custom elements are like components
            name: tagNameText,
            qualifiedName: tagNameText,
            startLine: startTag.startPosition.row + 1,
            startCol: startTag.startPosition.column,
            endLine: node.endPosition.row + 1,
            endCol: node.endPosition.column,
            exported: true,
          });
        }
      }
    }

    // Extract script tags
    if (node.type === 'script_element') {
      const startTag = node.childForFieldName('start_tag');
      const tagName = startTag?.childForFieldName('name');
      const scriptName = tagName?.text || 'script';
      
      symbols.push({
        language,
        kind: 'module',
        name: scriptName,
        qualifiedName: `<${scriptName}>`,
        startLine: node.startPosition.row + 1,
        startCol: node.startPosition.column,
        endLine: node.endPosition.row + 1,
        endCol: node.endPosition.column,
        exported: true,
      });
    }

    // Extract style tags
    if (node.type === 'style_element') {
      symbols.push({
        language,
        kind: 'module',
        name: 'style',
        qualifiedName: '<style>',
        startLine: node.startPosition.row + 1,
        startCol: node.startPosition.column,
        endLine: node.endPosition.row + 1,
        endCol: node.endPosition.column,
        exported: true,
      });
    }

    // Recurse into children
    for (const child of node.namedChildren) {
      this.extractSymbols(child, symbols, language, sourceLines);
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
    // Extract references to IDs in href, data attributes, etc.
    if (node.type === 'attribute') {
      const attrName = node.childForFieldName('name');
      const attrValue = node.childForFieldName('value');
      
      if (attrName && attrValue) {
        const nameText = attrName.text;
        
        // Check if this attribute references an ID (like href="#id", data-target="#id")
        if (attrValue.type === 'quoted_attribute_value') {
          const valueText = this.extractAttributeValue(node);
          if (valueText && valueText.startsWith('#')) {
            const idName = valueText.slice(1);
            references.push({
              name: idName,
              refKind: 'read',
              startLine: attrValue.startPosition.row + 1,
              startCol: attrValue.startPosition.column,
              endLine: attrValue.endPosition.row + 1,
              endCol: attrValue.endPosition.column,
            });
          }
        }
      }
    }

    // Extract class references in class attributes
    if (node.type === 'attribute' && node.childForFieldName('name')?.text === 'class') {
      const classValues = this.extractClassValues(node);
      for (const className of classValues) {
        references.push({
          name: className,
          refKind: 'read',
          startLine: node.startPosition.row + 1,
          startCol: node.startPosition.column,
          endLine: node.endPosition.row + 1,
          endCol: node.endPosition.column,
        });
      }
    }

    // Recurse into children
    for (const child of node.namedChildren) {
      this.extractCallsAndReferences(child, calls, references, sourceLines);
    }
  }

  private findAttribute(startTag: Parser.SyntaxNode, attributeName: string): Parser.SyntaxNode | null {
    for (const child of startTag.namedChildren) {
      if (child.type === 'attribute') {
        const nameNode = child.childForFieldName('name');
        if (nameNode && nameNode.text === attributeName) {
          return child;
        }
      }
    }
    return null;
  }

  private extractAttributeValue(attributeNode: Parser.SyntaxNode): string | null {
    const valueNode = attributeNode.childForFieldName('value');
    if (!valueNode) return null;

    if (valueNode.type === 'quoted_attribute_value') {
      // Remove quotes from the value
      const text = valueNode.text;
      if (text.length >= 2) {
        return text.slice(1, -1); // Remove first and last character (quotes)
      }
      return text;
    }
    
    return valueNode.text;
  }

  private extractClassValues(attributeNode: Parser.SyntaxNode): string[] {
    const value = this.extractAttributeValue(attributeNode);
    if (!value) return [];

    // Split by whitespace and filter empty strings
    return value.split(/\s+/).filter(cls => cls.length > 0);
  }

  private isStandardHtmlTag(tagName: string): boolean {
    // Common HTML5 tags
    const standardTags = new Set([
      'html', 'head', 'body', 'title', 'meta', 'link', 'style', 'script',
      'div', 'span', 'p', 'a', 'img', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th',
      'form', 'input', 'button', 'textarea', 'select', 'option',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'header', 'footer', 'nav', 'section', 'article', 'aside', 'main',
      'br', 'hr', 'strong', 'em', 'b', 'i', 'u', 'code', 'pre',
      'canvas', 'svg', 'video', 'audio', 'iframe',
      'dl', 'dt', 'dd', 'blockquote', 'cite', 'abbr', 'address'
    ]);
    
    return standardTags.has(tagName.toLowerCase());
  }
}

