/**
 * Query engine for code index
 */

import { CodeDatabase } from '../storage/database.js';
import type {
  QuerySymbolOptions,
  CallChainOptions,
  CallNode,
  Location,
  SymbolRecord,
} from '../core/types.js';

export class QueryEngine {
  constructor(private db: CodeDatabase) {}

  findSymbol(options: QuerySymbolOptions): SymbolRecord | null {
    const symbols = this.db.findSymbolsByName(options.name, options.language);
    
    if (symbols.length === 0) {
      return null;
    }

    // If multiple matches, try to filter by file or kind
    if (symbols.length > 1) {
      if (options.inFile) {
        const fileFiltered = symbols.filter(s => {
          const location = this.db.getSymbolLocation(s.symbolId!);
          return location?.path.includes(options.inFile!);
        });
        if (fileFiltered.length > 0) {
          return fileFiltered[0];
        }
      }

      if (options.kind) {
        const kindFiltered = symbols.filter(s => s.kind === options.kind);
        if (kindFiltered.length > 0) {
          return kindFiltered[0];
        }
      }
    }

    return symbols[0];
  }

  findSymbols(options: QuerySymbolOptions): SymbolRecord[] {
    return this.db.findSymbolsByName(options.name, options.language);
  }

  getDefinition(symbolId: number): Location | null {
    return this.db.getSymbolLocation(symbolId) || null;
  }

  getReferences(symbolId: number): Location[] {
    const refs = this.db.getReferencesToSymbol(symbolId);
    const locations: Location[] = [];

    for (const ref of refs) {
      const file = this.db.getFileByPath(''); // Need to get file by ID
      // For now, return basic location
      locations.push({
        fileId: ref.fromFileId,
        path: '', // Would need to lookup
        startLine: ref.fromStartLine,
        startCol: ref.fromStartCol,
        endLine: ref.fromEndLine,
        endCol: ref.fromEndCol,
      });
    }

    return locations;
  }

  buildCallChain(options: CallChainOptions): CallNode | null {
    const symbol = this.db.getSymbolById(options.from);
    if (!symbol) {
      return null;
    }

    const location = this.db.getSymbolLocation(options.from);
    if (!location) {
      return null;
    }

    const direction = options.direction || 'forward';
    const maxDepth = options.depth || 5;

    const visited = new Set<number>();
    
    const buildNode = (symbolId: number, depth: number): CallNode | null => {
      if (depth > maxDepth || visited.has(symbolId)) {
        return null;
      }

      visited.add(symbolId);

      const sym = this.db.getSymbolById(symbolId);
      const loc = this.db.getSymbolLocation(symbolId);

      if (!sym || !loc) {
        return null;
      }

      const node: CallNode = {
        symbolId,
        name: sym.name,
        qualifiedName: sym.qualifiedName,
        location: loc,
        depth,
        children: [],
      };

      // Get related calls based on direction
      const calls = direction === 'forward'
        ? this.db.getCallsFrom(symbolId)
        : this.db.getCallsTo(symbolId);

      for (const call of calls) {
        const nextSymbolId = direction === 'forward'
          ? call.calleeSymbolId
          : call.callerSymbolId;

        const childNode = buildNode(nextSymbolId, depth + 1);
        if (childNode) {
          node.children!.push(childNode);
        }
      }

      return node;
    };

    return buildNode(options.from, 0);
  }

  getObjectProperties(objectName: string, language?: string): SymbolRecord[] {
    // Find the class/interface/struct
    const symbols = this.db.findSymbolsByName(objectName, language);
    
    if (symbols.length === 0) {
      return [];
    }

    // Try to find a class, interface, or struct
    const classSymbol = symbols.find(s => 
      s.kind === 'class' || 
      s.kind === 'interface' ||
      s.kind === 'struct'
    );
    
    if (!classSymbol) {
      // If no class/interface/struct found, return empty
      return [];
    }

    // Strategy 1: Find by qualified name prefix (works for most cases)
    // Look for symbols whose qualifiedName starts with "ClassName."
    const allSymbols = this.db.getAllSymbols();
    const byQualifiedName = allSymbols.filter(s => {
      // Check if this symbol belongs to the class
      const prefix = `${classSymbol.qualifiedName}.`;
      return s.qualifiedName.startsWith(prefix) &&
             (s.kind === 'method' || s.kind === 'property' || s.kind === 'field');
    });

    // Strategy 2: For Go, also check by receiver type in the same file or nearby files
    // This handles methods defined in different files
    if (language === 'go' || classSymbol.language === 'go') {
      // Find methods that reference this struct
      // In Go, method receivers are often stored in the qualifiedName
      const goMethods = allSymbols.filter(s => {
        if (s.kind !== 'method') return false;
        
        // Check if the method's qualified name contains the struct name
        // Format could be: "package.(*StructName).MethodName" or "package.StructName.MethodName"
        const structName = classSymbol.name;
        const patterns = [
          `${structName}.`,           // Simple case
          `(*${structName}).`,        // Pointer receiver
          `.${structName}.`,          // With package
        ];
        
        return patterns.some(pattern => s.qualifiedName.includes(pattern));
      });
      
      // Merge and deduplicate
      const combined = [...byQualifiedName];
      for (const method of goMethods) {
        if (!combined.find(s => s.symbolId === method.symbolId)) {
          combined.push(method);
        }
      }
      return combined;
    }

    return byQualifiedName;
  }

  // Statistics
  getStats(): {
    totalFiles: number;
    totalSymbols: number;
    totalCalls: number;
    totalReferences: number;
  } {
    // This would require additional queries, simplified for MVP
    return {
      totalFiles: 0,
      totalSymbols: 0,
      totalCalls: 0,
      totalReferences: 0,
    };
  }
}

