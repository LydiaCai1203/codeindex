"""Direct SQLite database access for CodeIndex"""

import sqlite3
import struct
from pathlib import Path
from typing import Optional, List, Dict, Any
from .types import FileRecord, SymbolRecord, CallRecord, ReferenceRecord, Location, Language, SymbolKind
from .exceptions import DatabaseNotFoundError, DatabaseError


class CodeIndexDatabase:
    """Direct access to CodeIndex SQLite database"""
    
    def __init__(self, db_path: str):
        self.db_path = Path(db_path)
        if not self.db_path.exists():
            raise DatabaseNotFoundError(f"Database not found: {db_path}")
        
        try:
            self.conn = sqlite3.connect(str(self.db_path))
            self.conn.row_factory = sqlite3.Row
        except sqlite3.Error as e:
            raise DatabaseError(f"Failed to connect to database: {e}") from e
    
    def close(self):
        """Close database connection"""
        if hasattr(self, 'conn'):
            self.conn.close()
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
    
    # File operations
    def get_file_by_path(self, path: str) -> Optional[FileRecord]:
        """Get file record by path"""
        try:
            cursor = self.conn.execute(
                "SELECT file_id, path, language, content_hash, mtime, size "
                "FROM files WHERE path = ?",
                (path,)
            )
            row = cursor.fetchone()
            if not row:
                return None
            return FileRecord(
                fileId=row['file_id'],
                path=row['path'],
                language=row['language'],
                contentHash=row['content_hash'],
                mtime=row['mtime'],
                size=row['size']
            )
        except sqlite3.Error as e:
            raise DatabaseError(f"Failed to get file by path: {e}") from e
    
    def get_file_by_id(self, file_id: int) -> Optional[FileRecord]:
        """Get file record by ID"""
        try:
            cursor = self.conn.execute(
                "SELECT file_id, path, language, content_hash, mtime, size "
                "FROM files WHERE file_id = ?",
                (file_id,)
            )
            row = cursor.fetchone()
            if not row:
                return None
            return FileRecord(
                fileId=row['file_id'],
                path=row['path'],
                language=row['language'],
                contentHash=row['content_hash'],
                mtime=row['mtime'],
                size=row['size']
            )
        except sqlite3.Error as e:
            raise DatabaseError(f"Failed to get file by ID: {e}") from e
    
    def get_all_files(self) -> List[FileRecord]:
        """Get all files"""
        try:
            cursor = self.conn.execute(
                "SELECT file_id, path, language, content_hash, mtime, size FROM files"
            )
            return [FileRecord(
                fileId=row['file_id'],
                path=row['path'],
                language=row['language'],
                contentHash=row['content_hash'],
                mtime=row['mtime'],
                size=row['size']
            ) for row in cursor.fetchall()]
        except sqlite3.Error as e:
            raise DatabaseError(f"Failed to get all files: {e}") from e
    
    # Symbol operations
    def find_symbols_by_name(
        self, 
        name: str, 
        language: Optional[str] = None
    ) -> List[SymbolRecord]:
        """Find symbols by name"""
        try:
            if language:
                cursor = self.conn.execute(
                    """SELECT symbol_id, file_id, language, kind, name, qualified_name,
                              start_line, start_col, end_line, end_col, signature, exported,
                              chunk_hash, chunk_summary, summary_tokens, summarized_at
                       FROM symbols WHERE name = ? AND language = ?""",
                    (name, language)
                )
            else:
                cursor = self.conn.execute(
                    """SELECT symbol_id, file_id, language, kind, name, qualified_name,
                              start_line, start_col, end_line, end_col, signature, exported,
                              chunk_hash, chunk_summary, summary_tokens, summarized_at
                       FROM symbols WHERE name = ?""",
                    (name,)
                )
            
            return [self._row_to_symbol(row) for row in cursor.fetchall()]
        except sqlite3.Error as e:
            raise DatabaseError(f"Failed to find symbols by name: {e}") from e
    
    def get_symbol_by_id(self, symbol_id: int) -> Optional[SymbolRecord]:
        """Get symbol by ID"""
        try:
            cursor = self.conn.execute(
                """SELECT symbol_id, file_id, language, kind, name, qualified_name,
                          start_line, start_col, end_line, end_col, signature, exported,
                          chunk_hash, chunk_summary, summary_tokens, summarized_at
                   FROM symbols WHERE symbol_id = ?""",
                (symbol_id,)
            )
            row = cursor.fetchone()
            if not row:
                return None
            return self._row_to_symbol(row)
        except sqlite3.Error as e:
            raise DatabaseError(f"Failed to get symbol by ID: {e}") from e
    
    def get_symbols_in_file(self, file_id: int) -> List[SymbolRecord]:
        """Get all symbols in a file"""
        try:
            cursor = self.conn.execute(
                """SELECT symbol_id, file_id, language, kind, name, qualified_name,
                          start_line, start_col, end_line, end_col, signature, exported,
                          chunk_hash, chunk_summary, summary_tokens, summarized_at
                   FROM symbols WHERE file_id = ?""",
                (file_id,)
            )
            return [self._row_to_symbol(row) for row in cursor.fetchall()]
        except sqlite3.Error as e:
            raise DatabaseError(f"Failed to get symbols in file: {e}") from e
    
    def get_all_symbols(self) -> List[SymbolRecord]:
        """Get all symbols (for object properties query)"""
        try:
            cursor = self.conn.execute(
                """SELECT symbol_id, file_id, language, kind, name, qualified_name,
                          start_line, start_col, end_line, end_col, signature, exported,
                          chunk_hash, chunk_summary, summary_tokens, summarized_at
                   FROM symbols"""
            )
            return [self._row_to_symbol(row) for row in cursor.fetchall()]
        except sqlite3.Error as e:
            raise DatabaseError(f"Failed to get all symbols: {e}") from e
    
    def get_symbol_location(self, symbol_id: int) -> Optional[Location]:
        """Get location of a symbol"""
        try:
            cursor = self.conn.execute(
                """SELECT s.file_id, f.path, s.start_line, s.start_col, 
                          s.end_line, s.end_col
                   FROM symbols s
                   JOIN files f ON s.file_id = f.file_id
                   WHERE s.symbol_id = ?""",
                (symbol_id,)
            )
            row = cursor.fetchone()
            if not row:
                return None
            return Location(
                fileId=row['file_id'],
                path=row['path'],
                startLine=row['start_line'],
                startCol=row['start_col'],
                endLine=row['end_line'],
                endCol=row['end_col']
            )
        except sqlite3.Error as e:
            raise DatabaseError(f"Failed to get symbol location: {e}") from e
    
    # Call operations
    def get_calls_from(self, caller_symbol_id: int) -> List[CallRecord]:
        """Get calls from a symbol"""
        try:
            cursor = self.conn.execute(
                """SELECT call_id, caller_symbol_id, callee_symbol_id, site_file_id,
                          site_start_line, site_start_col, site_end_line, site_end_col
                   FROM calls WHERE caller_symbol_id = ?""",
                (caller_symbol_id,)
            )
            return [self._row_to_call(row) for row in cursor.fetchall()]
        except sqlite3.Error as e:
            raise DatabaseError(f"Failed to get calls from symbol: {e}") from e
    
    def get_calls_to(self, callee_symbol_id: int) -> List[CallRecord]:
        """Get calls to a symbol"""
        try:
            cursor = self.conn.execute(
                """SELECT call_id, caller_symbol_id, callee_symbol_id, site_file_id,
                          site_start_line, site_start_col, site_end_line, site_end_col
                   FROM calls WHERE callee_symbol_id = ?""",
                (callee_symbol_id,)
            )
            return [self._row_to_call(row) for row in cursor.fetchall()]
        except sqlite3.Error as e:
            raise DatabaseError(f"Failed to get calls to symbol: {e}") from e
    
    # Reference operations
    def get_references_to_symbol(self, symbol_id: int) -> List[ReferenceRecord]:
        """Get references to a symbol"""
        try:
            cursor = self.conn.execute(
                """SELECT ref_id, from_file_id, from_start_line, from_start_col,
                          from_end_line, from_end_col, to_symbol_id, ref_kind
                   FROM symbol_references WHERE to_symbol_id = ?""",
                (symbol_id,)
            )
            return [self._row_to_reference(row) for row in cursor.fetchall()]
        except sqlite3.Error as e:
            raise DatabaseError(f"Failed to get references to symbol: {e}") from e
    
    # Embedding operations
    def get_embeddings_by_model(
        self,
        model: str,
        language: Optional[str] = None,
        kind: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get embeddings by model, optionally filtered by language and kind"""
        try:
            query = """
                SELECT e.symbol_id, e.dim, e.embedding, s.language, s.kind
                FROM symbol_embeddings e
                JOIN symbols s ON e.symbol_id = s.symbol_id
                WHERE e.model = ?
            """
            params = [model]
            
            if language:
                query += " AND s.language = ?"
                params.append(language)
            
            if kind:
                query += " AND s.kind = ?"
                params.append(kind)
            
            cursor = self.conn.execute(query, params)
            results = []
            for row in cursor.fetchall():
                # Convert BLOB to list of floats
                # SQLite stores floats as 4-byte little-endian IEEE 754
                embedding_blob = row['embedding']
                dim = row['dim']
                
                # Unpack floats from bytes (little-endian, float32)
                embedding = list(struct.unpack(f'<{dim}f', embedding_blob))
                
                results.append({
                    'symbolId': row['symbol_id'],
                    'dim': dim,
                    'embedding': embedding,
                })
            return results
        except sqlite3.Error as e:
            raise DatabaseError(f"Failed to get embeddings by model: {e}") from e
    
    # Helper methods
    def _row_to_symbol(self, row) -> SymbolRecord:
        """Convert database row to SymbolRecord"""
        return SymbolRecord(
            symbolId=row['symbol_id'],
            fileId=row['file_id'],
            language=row['language'],
            kind=row['kind'],
            name=row['name'],
            qualifiedName=row['qualified_name'],
            startLine=row['start_line'],
            startCol=row['start_col'],
            endLine=row['end_line'],
            endCol=row['end_col'],
            signature=row['signature'],
            exported=bool(row['exported']),
            chunkHash=row['chunk_hash'],
            chunkSummary=row['chunk_summary'],
            summaryTokens=row['summary_tokens'],
            summarizedAt=row['summarized_at']
        )
    
    def _row_to_call(self, row) -> CallRecord:
        """Convert database row to CallRecord"""
        return CallRecord(
            callId=row['call_id'],
            callerSymbolId=row['caller_symbol_id'],
            calleeSymbolId=row['callee_symbol_id'],
            siteFileId=row['site_file_id'],
            siteStartLine=row['site_start_line'],
            siteStartCol=row['site_start_col'],
            siteEndLine=row['site_end_line'],
            siteEndCol=row['site_end_col']
        )
    
    def _row_to_reference(self, row) -> ReferenceRecord:
        """Convert database row to ReferenceRecord"""
        return ReferenceRecord(
            refId=row['ref_id'],
            fromFileId=row['from_file_id'],
            fromStartLine=row['from_start_line'],
            fromStartCol=row['from_start_col'],
            fromEndLine=row['from_end_line'],
            fromEndCol=row['from_end_col'],
            toSymbolId=row['to_symbol_id'],
            refKind=row['ref_kind']
        )

