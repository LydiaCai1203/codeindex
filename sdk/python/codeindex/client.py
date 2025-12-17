"""Python SDK client for CodeIndex"""

from __future__ import annotations
import json
import os
from pathlib import Path
from typing import Any, Dict, Optional, Union

from .database import CodeIndexDatabase
from .query import CodeIndexQuery
from .config import CodeIndexConfig
from .exceptions import DatabaseNotFoundError
from .embeddings_generator import EmbeddingsGenerator


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
        self._embedding_generator: Optional[EmbeddingsGenerator] = None
        self._config_data: Optional[Dict[str, Any]] = None
    
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
    
    def _load_config(self) -> Optional[Dict[str, Any]]:
        """Load configuration from codeindex.config.json if exists"""
        if self._config_data is not None:
            return self._config_data
        
        # Try to find config file starting from database directory
        db_path_obj = Path(self.db_path).resolve()
        search_dirs = [
            db_path_obj.parent,  # Database directory
            Path.cwd(),  # Current working directory
        ]
        
        # Also add parent directories of database path (up to 5 levels)
        current = db_path_obj.parent
        for _ in range(5):
            search_dirs.append(current)
            if current == current.parent:  # Reached root
                break
            current = current.parent
        
        # Search for config file
        for search_dir in search_dirs:
            config_path = search_dir / 'codeindex.config.json'
            if config_path.exists():
                try:
                    with open(config_path, 'r', encoding='utf-8') as f:
                        self._config_data = json.load(f)
                        return self._config_data
                except Exception:
                    continue
        
        # Mark as loaded (None) to avoid repeated searches
        self._config_data = {}
        return None
    
    def _get_embedding_generator(
        self,
        api_endpoint: Optional[str] = None,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        dimension: Optional[int] = None,
    ) -> EmbeddingsGenerator:
        """Get or create embedding generator"""
        # If generator exists and matches requirements, reuse it
        if self._embedding_generator:
            if not api_endpoint and not api_key and not model:
                return self._embedding_generator
        
        # Resolve parameters (function args > env > config > default)
        # Priority: function args > environment variables > config file
        
        # Load config if not already loaded (only if env vars not set)
        config = None
        embedding_config = {}
        if not os.getenv('CODEINDEX_EMBEDDING_API_ENDPOINT') and not os.getenv('CODEINDEX_EMBEDDING_API_KEY'):
            config = self._load_config()
            embedding_config = config.get('embedding', {}) if config else {}
        
        final_api_endpoint = (
            api_endpoint or
            os.getenv('CODEINDEX_EMBEDDING_API_ENDPOINT') or
            embedding_config.get('apiEndpoint')
        )
        
        final_api_key = (
            api_key or
            os.getenv('CODEINDEX_EMBEDDING_API_KEY') or
            os.getenv('OPENAI_API_KEY') or
            embedding_config.get('apiKey')
        )
        
        final_model = (
            model or
            os.getenv('CODEINDEX_EMBEDDING_MODEL') or
            embedding_config.get('defaultModel') or
            embedding_config.get('model')
        )
        
        final_dimension = (
            dimension or
            (os.getenv('CODEINDEX_EMBEDDING_DIMENSION') and int(os.getenv('CODEINDEX_EMBEDDING_DIMENSION'))) or
            embedding_config.get('dimension')
        )
        
        if not final_api_endpoint or not final_api_key:
            raise ValueError(
                "Missing embedding configuration. Please provide api_endpoint and api_key, "
                "or set CODEINDEX_EMBEDDING_API_ENDPOINT and CODEINDEX_EMBEDDING_API_KEY "
                "environment variables, or set them in codeindex.config.json."
            )
        
        if not final_model:
            raise ValueError(
                "Missing embedding model. Please provide model parameter, "
                "or set CODEINDEX_EMBEDDING_MODEL environment variable, "
                "or set it in codeindex.config.json embedding.model or embedding.defaultModel."
            )
        
        # Create new generator
        self._embedding_generator = EmbeddingsGenerator(
            api_endpoint=final_api_endpoint,
            api_key=final_api_key,
            model=final_model,
            dimension=final_dimension,
            timeout=embedding_config.get('timeout', 30),
            max_retries=embedding_config.get('maxRetries', 3),
        )
        
        return self._embedding_generator
    
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
        model: Optional[str] = None,
        top_k: int = 10,
        language: Optional[str] = None,
        kind: Optional[str] = None,
        min_similarity: float = 0.7,
        # Embedding API configuration (optional, can be loaded from config)
        api_endpoint: Optional[str] = None,
        api_key: Optional[str] = None,
        dimension: Optional[int] = None,
        **kwargs: Any  # For backward compatibility
    ) -> list[Dict[str, Any]]:
        """
        Semantic search using embeddings
        
        Args:
            query: Natural language query text (required if query_embedding not provided)
            query_embedding: Query embedding vector (optional, will be generated from query if not provided)
            model: Embedding model name (optional, will be loaded from config if not provided)
            top_k: Number of results to return
            language: Optional language filter
            kind: Optional symbol kind filter
            min_similarity: Minimum similarity threshold
            api_endpoint: Embedding API endpoint (optional, will be loaded from config if not provided)
            api_key: Embedding API key (optional, will be loaded from config if not provided)
            dimension: Embedding dimension (optional, will be loaded from config if not provided)
            **kwargs: Additional options (for backward compatibility)
        
        Returns:
            List of search results with similarity scores
        
        Examples:
            # Natural language query (recommended)
            results = client.semantic_search(query="用户登录验证", top_k=5)
            
            # With explicit embedding config
            results = client.semantic_search(
                query="用户登录验证",
                api_endpoint="https://api.example.com/v1/embeddings",
                api_key="your-api-key",
                model="bge-m3",
                top_k=5
            )
            
            # Using pre-computed embedding
            results = client.semantic_search(
                query="用户登录验证",
                query_embedding=[0.1, 0.2, ...],
                model="bge-m3",
                top_k=5
            )
        """
        self._ensure_connected()
        
        # Support old API format
        if query is None:
            query = kwargs.get('query', '')
        if query_embedding is None:
            query_embedding = kwargs.get('queryEmbedding') or kwargs.get('query_embedding')
        
        # If query_embedding is not provided, generate it from query text
        if query_embedding is None:
            if not query:
                raise ValueError(
                    "Either query or query_embedding must be provided. "
                    "For natural language search, provide query text."
                )
            
            # Get embedding generator and generate embedding
            embedding_gen = self._get_embedding_generator(
                api_endpoint=api_endpoint,
                api_key=api_key,
                model=model,
                dimension=dimension,
            )
            
            # Generate embedding from query text
            query_embedding_array = embedding_gen.generate_query_embedding(query)
            query_embedding = query_embedding_array.tolist()
            
            # Use generator's model if model not explicitly provided
            if model is None:
                model = embedding_gen.get_model()
        
        # Resolve model name (priority: function arg > env > config > generator)
        if model is None or model == "default":
            # Try environment variable first
            model = os.getenv('CODEINDEX_EMBEDDING_MODEL')
            
            # Then try config file
            if not model:
                config = self._load_config()
                if config:
                    embedding_config = config.get('embedding', {})
                    model = embedding_config.get('defaultModel') or embedding_config.get('model')
            
            # Finally try generator's model
            if not model:
                if self._embedding_generator:
                    model = self._embedding_generator.get_model()
                else:
                    raise ValueError(
                        "Model is required. Please provide model parameter, "
                        "or set CODEINDEX_EMBEDDING_MODEL environment variable, "
                        "or set it in codeindex.config.json."
                    )
        
        # Support old API parameter names
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
