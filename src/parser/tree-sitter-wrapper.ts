/**
 * Tree-sitter parser wrapper
 */

import Parser from 'tree-sitter';
import type { Language } from '../core/types.js';

export interface ParseResult {
  tree: Parser.Tree;
  language: Language;
  source: string;
}

export class TreeSitterParser {
  private parsers: Map<Language, Parser> = new Map();
  private languages: Map<Language, any> = new Map();

  async init(languages: Language[]): Promise<void> {
    for (const lang of languages) {
      const grammar = await this.loadGrammar(lang);
      this.languages.set(lang, grammar);
      
      const parser = new Parser();
      parser.setLanguage(grammar);
      this.parsers.set(lang, parser);
    }
  }

  private async loadGrammar(language: Language): Promise<any> {
    switch (language) {
      case 'js':
      case 'jsx':
        const { default: JavaScript } = await import('tree-sitter-javascript');
        return JavaScript;
      
      case 'ts':
        const { default: TypeScript } = await import('tree-sitter-typescript');
        return TypeScript.typescript;
      
      case 'tsx':
        const { default: TSX } = await import('tree-sitter-typescript');
        return TSX.tsx;
      
      case 'go':
        const { default: Go } = await import('tree-sitter-go');
        return Go;
      
      case 'python':
        const { default: Python } = await import('tree-sitter-python');
        return Python;
      
      case 'rust':
        const { default: Rust } = await import('tree-sitter-rust');
        return Rust;
      
      case 'java':
        const { default: Java } = await import('tree-sitter-java');
        return Java;
      
      case 'html':
        const { default: HTML } = await import('tree-sitter-html');
        return HTML;
      
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  parse(source: string, language: Language): ParseResult {
    const parser = this.parsers.get(language);
    if (!parser) {
      throw new Error(`Parser not initialized for language: ${language}`);
    }

    const tree = parser.parse(source);
    return { tree, language, source };
  }

  getLanguageForFile(filePath: string): Language | null {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'mjs':
      case 'cjs':
        return 'js';
      case 'jsx':
        return 'jsx';
      case 'ts':
      case 'mts':
      case 'cts':
        return 'ts';
      case 'tsx':
        return 'tsx';
      case 'go':
        return 'go';
      case 'py':
      case 'pyw':
        return 'python';
      case 'rs':
        return 'rust';
      case 'java':
        return 'java';
      case 'html':
      case 'htm':
        return 'html';
      default:
        return null;
    }
  }
}

