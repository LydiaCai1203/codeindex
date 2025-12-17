"""High-level query functions"""

from typing import Optional, List, Dict, Any
import numpy as np
from .database import CodeIndexDatabase
from .types import SymbolRecord, CallNode, PropertyNode, Location, Language, SymbolKind


class CodeIndexQuery:
    """High-level query interface"""
    
    def __init__(self, db: CodeIndexDatabase):
        self.db = db
    
    def find_symbol(
        self,
        name: str,
        language: Optional[Language] = None,
        in_file: Optional[str] = None,
        kind: Optional[SymbolKind] = None
    ) -> Optional[Dict[str, Any]]:
        """Find a single symbol matching criteria"""
        symbols = self.db.find_symbols_by_name(name, language)
        
        if not symbols:
            return None
        
        # Filter by file if specified
        if in_file and len(symbols) > 1:
            file_filtered = []
            for s in symbols:
                loc = self.db.get_symbol_location(s.symbolId)
                if loc and in_file in loc.path:
                    file_filtered.append(s)
            if file_filtered:
                symbols = file_filtered
        
        # Filter by kind if specified
        if kind and len(symbols) > 1:
            kind_filtered = [s for s in symbols if s.kind == kind]
            if kind_filtered:
                symbols = kind_filtered
        
        if not symbols:
            return None
        
        symbol = symbols[0]
        location = self.db.get_symbol_location(symbol.symbolId)
        return self._symbol_to_dict(symbol, location)
    
    def find_symbols(
        self,
        name: str,
        language: Optional[Language] = None
    ) -> List[Dict[str, Any]]:
        """Find all symbols matching name"""
        symbols = self.db.find_symbols_by_name(name, language)
        results = []
        for symbol in symbols:
            location = self.db.get_symbol_location(symbol.symbolId)
            results.append(self._symbol_to_dict(symbol, location))
        return results
    
    def get_definition(self, symbol_id: int) -> Optional[Dict[str, Any]]:
        """Get definition location of a symbol"""
        location = self.db.get_symbol_location(symbol_id)
        if not location:
            return None
        return {
            'fileId': location.fileId,
            'path': location.path,
            'startLine': location.startLine,
            'startCol': location.startCol,
            'endLine': location.endLine,
            'endCol': location.endCol,
        }
    
    def get_references(self, symbol_id: int) -> List[Dict[str, Any]]:
        """Get all references to a symbol"""
        refs = self.db.get_references_to_symbol(symbol_id)
        locations = []
        for ref in refs:
            file = self.db.get_file_by_id(ref.fromFileId)
            if file:
                locations.append({
                    'fileId': ref.fromFileId,
                    'path': file.path,
                    'startLine': ref.fromStartLine,
                    'startCol': ref.fromStartCol,
                    'endLine': ref.fromEndLine,
                    'endCol': ref.fromEndCol,
                })
        return locations
    
    def build_call_chain(
        self,
        from_symbol_id: int,
        direction: str = 'forward',
        depth: int = 5
    ) -> Optional[Dict[str, Any]]:
        """Build call chain starting from a symbol"""
        symbol = self.db.get_symbol_by_id(from_symbol_id)
        if not symbol:
            return None
        
        location = self.db.get_symbol_location(from_symbol_id)
        if not location:
            return None
        
        visited = set()
        
        def build_node(symbol_id: int, depth_level: int) -> Optional[Dict[str, Any]]:
            if depth_level > depth or symbol_id in visited:
                return None
            
            visited.add(symbol_id)
            
            sym = self.db.get_symbol_by_id(symbol_id)
            loc = self.db.get_symbol_location(symbol_id)
            
            if not sym or not loc:
                return None
            
            node = {
                'symbolId': symbol_id,
                'name': sym.name,
                'qualifiedName': sym.qualifiedName,
                'location': {
                    'fileId': loc.fileId,
                    'path': loc.path,
                    'startLine': loc.startLine,
                    'startCol': loc.startCol,
                    'endLine': loc.endLine,
                    'endCol': loc.endCol,
                },
                'depth': depth_level,
                'children': [],
            }
            
            # Get calls based on direction
            calls = (
                self.db.get_calls_from(symbol_id) if direction == 'forward'
                else self.db.get_calls_to(symbol_id)
            )
            
            for call in calls:
                next_symbol_id = (
                    call.calleeSymbolId if direction == 'forward'
                    else call.callerSymbolId
                )
                child = build_node(next_symbol_id, depth_level + 1)
                if child:
                    node['children'].append(child)
            
            return node
        
        return build_node(from_symbol_id, 0)
    
    def get_object_properties(
        self,
        object_name: str,
        language: Optional[Language] = None
    ) -> List[Dict[str, Any]]:
        """Get properties/methods of an object/class/struct"""
        symbols = self.db.find_symbols_by_name(object_name, language)
        
        if not symbols:
            return []
        
        # Find class/interface/struct
        class_symbol = next(
            (s for s in symbols if s.kind in ('class', 'interface', 'struct')),
            None
        )
        
        if not class_symbol:
            return []
        
        # Get all symbols (we need to filter by qualified name)
        # For efficiency, we can query symbols with qualified_name LIKE pattern
        prefix = f"{class_symbol.qualifiedName}."
        properties = []
        
        # Query symbols with qualified name prefix
        # Use get_all_symbols and filter, or add a method to database
        all_symbols = self.db.get_all_symbols()
        if language:
            all_symbols = [s for s in all_symbols if s.language == language]
        
        symbol_ids = [s.symbolId for s in all_symbols if s.qualifiedName.startswith(prefix)]
        
        for symbol_id in symbol_ids:
            symbol = self.db.get_symbol_by_id(symbol_id)
            if not symbol:
                continue
            
            if symbol.kind in ('method', 'property', 'field'):
                loc = self.db.get_symbol_location(symbol.symbolId)
                if loc:
                    properties.append({
                        'name': symbol.name,
                        'kind': symbol.kind,
                        'location': {
                            'fileId': loc.fileId,
                            'path': loc.path,
                            'startLine': loc.startLine,
                            'startCol': loc.startCol,
                            'endLine': loc.endLine,
                            'endCol': loc.endCol,
                        },
                        'signature': symbol.signature,
                    })
        
        # For Go, also check methods with receiver patterns
        if language == 'go' or class_symbol.language == 'go':
            struct_name = class_symbol.name
            patterns = [
                f"{struct_name}.",
                f"(*{struct_name}).",
                f".{struct_name}.",
            ]
            
            # Query for Go methods
            go_symbols = self.db.get_all_symbols()
            go_symbol_ids = [
                s.symbolId for s in go_symbols
                if s.language == 'go' and s.kind == 'method'
            ]
            
            for symbol_id in go_symbol_ids:
                symbol = self.db.get_symbol_by_id(symbol_id)
                if not symbol:
                    continue
                
                if any(pattern in symbol.qualifiedName for pattern in patterns):
                    # Check if already added
                    if not any(p['name'] == symbol.name for p in properties):
                        loc = self.db.get_symbol_location(symbol.symbolId)
                        if loc:
                            properties.append({
                                'name': symbol.name,
                                'kind': symbol.kind,
                                'location': {
                                    'fileId': loc.fileId,
                                    'path': loc.path,
                                    'startLine': loc.startLine,
                                    'startCol': loc.startCol,
                                    'endLine': loc.endLine,
                                    'endCol': loc.endCol,
                                },
                                'signature': symbol.signature,
                            })
        
        return properties
    
    def semantic_search(
        self,
        query: str,
        query_embedding: List[float],
        model: str = "default",
        top_k: int = 10,
        language: Optional[Language] = None,
        kind: Optional[SymbolKind] = None,
        min_similarity: float = 0.7
    ) -> List[Dict[str, Any]]:
        """Semantic search using embeddings"""
        candidates = self.db.get_embeddings_by_model(model, language, kind)
        
        if not candidates:
            return []
        
        query_array = np.array(query_embedding, dtype=np.float32)
        results = []
        
        for candidate in candidates:
            if len(candidate['embedding']) != len(query_embedding):
                continue
            
            candidate_array = np.array(candidate['embedding'], dtype=np.float32)
            
            # Calculate cosine similarity (dot product for normalized vectors)
            # Normalize vectors first
            query_norm = query_array / (np.linalg.norm(query_array) + 1e-8)
            candidate_norm = candidate_array / (np.linalg.norm(candidate_array) + 1e-8)
            
            dot_product = np.dot(query_norm, candidate_norm)
            
            # Cosine similarity is in [-1, 1], map to [0, 1]
            similarity = (dot_product + 1) / 2
            
            if similarity >= min_similarity:
                symbol = self.db.get_symbol_by_id(candidate['symbolId'])
                location = self.db.get_symbol_location(candidate['symbolId'])
                
                if symbol and location:
                    results.append({
                        'symbol': self._symbol_to_dict(symbol, location),
                        'similarity': float(similarity),
                        'location': {
                            'fileId': location.fileId,
                            'path': location.path,
                            'startLine': location.startLine,
                            'startCol': location.startCol,
                            'endLine': location.endLine,
                            'endCol': location.endCol,
                        },
                    })
        
        # Sort by similarity and return top-k
        results.sort(key=lambda x: x['similarity'], reverse=True)
        return results[:top_k]
    
    def _symbol_to_dict(self, symbol: SymbolRecord, location: Optional[Location]) -> Dict[str, Any]:
        """Convert SymbolRecord to dictionary"""
        result = {
            'symbolId': symbol.symbolId,
            'fileId': symbol.fileId,
            'language': symbol.language,
            'kind': symbol.kind,
            'name': symbol.name,
            'qualifiedName': symbol.qualifiedName,
            'startLine': symbol.startLine,
            'startCol': symbol.startCol,
            'endLine': symbol.endLine,
            'endCol': symbol.endCol,
            'signature': symbol.signature,
            'exported': symbol.exported,
            'chunkHash': symbol.chunkHash,
            'chunkSummary': symbol.chunkSummary,
            'summaryTokens': symbol.summaryTokens,
            'summarizedAt': symbol.summarizedAt,
        }
        
        if location:
            result['location'] = {
                'fileId': location.fileId,
                'path': location.path,
                'startLine': location.startLine,
                'startCol': location.startCol,
                'endLine': location.endLine,
                'endCol': location.endCol,
            }
        
        return result

