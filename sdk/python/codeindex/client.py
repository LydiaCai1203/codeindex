"""Python SDK client for CodeIndex"""

from __future__ import annotations
from typing import Any, Dict, Optional, Union

from .database import CodeIndexDatabase
from .query import CodeIndexQuery
from .config import CodeIndexConfig
from .exceptions import DatabaseNotFoundError


class CodeIndexClient:
    """Client for querying CodeIndex SQLite database"""
    
    def __init__(
        self,
        db_path: Union[str, CodeIndexConfig],
        # Legacy parameters (kept for backward compatibility, ignored)
        node_command: Optional[str] = None,
        worker_path: Optional[str] = None,
        startup_timeout: float = 30.0,
    ):
        """
        Initialize CodeIndex client
        
        Args:
            db_path: Path to the SQLite database file, or CodeIndexConfig instance
            node_command: Deprecated, ignored
            worker_path: Deprecated, ignored
            startup_timeout: Deprecated, ignored
        """
        # Support both string path and CodeIndexConfig for backward compatibility
        if isinstance(db_path, CodeIndexConfig):
            self.db_path = db_path.db_path
        else:
            self.db_path = db_path
        
        self._db: Optional[CodeIndexDatabase] = None
        self._query: Optional[CodeIndexQuery] = None
    
    def __enter__(self) -> "CodeIndexClient":
        self._ensure_connected()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()
    
    def _ensure_connected(self) -> None:
        """Ensure database connection is established"""
        if not self._db or not self._query:
            self._db = CodeIndexDatabase(self.db_path)
            self._query = CodeIndexQuery(self._db)
    
    def start(self) -> None:
        """Start client (for backward compatibility, no-op now)"""
        self._ensure_connected()
    
    def close(self) -> None:
        """Close database connection"""
        if self._db:
            self._db.close()
            self._db = None
            self._query = None
    
    def find_symbols(
        self,
        name: Optional[str] = None,
        language: Optional[str] = None,
        **kwargs: Any  # For backward compatibility
    ) -> list[Dict[str, Any]]:
        """
        Find all symbols matching name
        
        Args:
            name: Symbol name to search for
            language: Optional language filter
            **kwargs: Additional query parameters (for backward compatibility)
        
        Returns:
            List of symbol dictionaries
        """
        self._ensure_connected()
        
        # Support both new API (name as positional/keyword) and old API (in kwargs)
        if name is None and 'name' in kwargs:
            name = kwargs['name']
        
        if not name:
            raise ValueError("name parameter is required")
        
        return self._query.find_symbols(name, language)
    
    def find_symbol(
        self,
        name: Optional[str] = None,
        language: Optional[str] = None,
        in_file: Optional[str] = None,
        kind: Optional[str] = None,
        **kwargs: Any  # For backward compatibility
    ) -> Optional[Dict[str, Any]]:
        """
        Find a single symbol matching criteria
        
        Args:
            name: Symbol name to search for
            language: Optional language filter
            in_file: Optional file path filter
            kind: Optional symbol kind filter
            **kwargs: Additional query parameters (for backward compatibility)
        
        Returns:
            Symbol dictionary or None if not found
        """
        self._ensure_connected()
        
        # Support both new API and old API (query dict in kwargs)
        if name is None:
            if 'query' in kwargs:
                query = kwargs['query']
                name = query.get('name')
                language = query.get('language', language)
                in_file = query.get('inFile', in_file)
                kind = query.get('kind', kind)
            elif 'name' in kwargs:
                name = kwargs['name']
        
        if not name:
            raise ValueError("name parameter is required")
        
        return self._query.find_symbol(name, language, in_file, kind)
    
    def object_properties(
        self,
        object_name: str,
        language: Optional[str] = None
    ) -> list[Dict[str, Any]]:
        """
        Get properties/methods of an object/class/struct
        
        Args:
            object_name: Name of the object/class/struct
            language: Optional language filter
        
        Returns:
            List of property dictionaries
        """
        self._ensure_connected()
        return self._query.get_object_properties(object_name, language)
    
    def call_chain(
        self,
        from_symbol: Optional[int] = None,
        direction: str = "forward",
        depth: int = 5,
        **kwargs: Any  # For backward compatibility
    ) -> Optional[Dict[str, Any]]:
        """
        Build call chain starting from a symbol
        
        Args:
            from_symbol: Symbol ID to start from
            direction: 'forward' or 'backward'
            depth: Maximum depth of the chain
            **kwargs: Additional options (for backward compatibility)
        
        Returns:
            Call chain dictionary or None if symbol not found
        """
        self._ensure_connected()
        
        # Support both new API and old API
        if from_symbol is None:
            from_symbol = kwargs.get('from') or kwargs.get('from_symbol')
        
        if from_symbol is None:
            raise ValueError("from_symbol parameter is required")
        
        direction = kwargs.get('direction', direction)
        depth = kwargs.get('depth', depth)
        
        return self._query.build_call_chain(from_symbol, direction, depth)
    
    def definition(self, symbol_id: int) -> Optional[Dict[str, Any]]:
        """
        Get definition location of a symbol
        
        Args:
            symbol_id: Symbol ID
        
        Returns:
            Location dictionary or None if not found
        """
        self._ensure_connected()
        return self._query.get_definition(symbol_id)
    
    def references(self, symbol_id: int) -> list[Dict[str, Any]]:
        """
        Get all references to a symbol
        
        Args:
            symbol_id: Symbol ID
        
        Returns:
            List of reference location dictionaries
        """
        self._ensure_connected()
        return self._query.get_references(symbol_id)
    
    def semantic_search(
        self,
        query: Optional[str] = None,
        query_embedding: Optional[list[float]] = None,
        model: str = "default",
        top_k: int = 10,
        language: Optional[str] = None,
        kind: Optional[str] = None,
        min_similarity: float = 0.7,
        **kwargs: Any  # For backward compatibility
    ) -> list[Dict[str, Any]]:
        """
        Semantic search using embeddings
        
        Args:
            query: Query text (for reference, embedding must be provided)
            query_embedding: Query embedding vector (required)
            model: Embedding model name
            top_k: Number of results to return
            language: Optional language filter
            kind: Optional symbol kind filter
            min_similarity: Minimum similarity threshold
            **kwargs: Additional options (for backward compatibility)
        
        Returns:
            List of search results with similarity scores
        
        Note:
            You need to generate query_embedding yourself using an embedding model
        """
        self._ensure_connected()
        
        # Support old API format
        if query is None:
            query = kwargs.get('query', '')
        if query_embedding is None:
            query_embedding = kwargs.get('queryEmbedding') or kwargs.get('query_embedding')
        
        if query_embedding is None:
            raise ValueError("query_embedding parameter is required")
        
        model = kwargs.get('model', model)
        top_k = kwargs.get('topK', kwargs.get('top_k', top_k))
        language = kwargs.get('language', language)
        kind = kwargs.get('kind', kind)
        min_similarity = kwargs.get('minSimilarity', kwargs.get('min_similarity', min_similarity))
        
        return self._query.semantic_search(
            query or '',
            query_embedding,
            model,
            top_k,
            language,
            kind,
            min_similarity
        )
