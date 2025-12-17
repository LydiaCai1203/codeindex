"""Embedding generator for Python SDK - generates vector embeddings for query text"""

from __future__ import annotations

import json
import time
from typing import List, Optional, Dict, Any
import requests
import numpy as np


class EmbeddingsGenerator:
    """Generate embeddings using embedding API"""
    
    def __init__(
        self,
        api_endpoint: str,
        api_key: str,
        model: str,
        dimension: Optional[int] = None,
        timeout: int = 30,
        max_retries: int = 3,
    ):
        """
        Initialize EmbeddingsGenerator
        
        Args:
            api_endpoint: Embedding API endpoint URL
            api_key: API key for authentication
            model: Embedding model name
            dimension: Optional dimension (some models don't support this)
            timeout: Request timeout in seconds
            max_retries: Maximum number of retry attempts
        """
        # Default dimensions for common models
        default_dimensions: Dict[str, int] = {
            'text-embedding-3-small': 1536,
            'text-embedding-3-large': 3072,
            'text-embedding-ada-002': 1536,
            'bge-m3': 1024,
            'bge-large-en': 1024,
            'bge-base-en': 768,
        }
        
        self.api_endpoint = api_endpoint
        self.api_key = api_key
        self.model = model
        self.dimension = dimension or default_dimensions.get(model, 1536)
        self.timeout = timeout
        self.max_retries = max_retries
    
    def generate_query_embedding(self, text: str) -> np.ndarray:
        """
        Generate embedding for query text
        
        Args:
            text: Query text to embed
            
        Returns:
            Normalized embedding vector as numpy array
        """
        embedding = self._call_embedding_api(text)
        return self._normalize_vector(embedding)
    
    def _call_embedding_api(self, text: str) -> List[float]:
        """
        Call embedding API
        
        Args:
            text: Text to embed
            
        Returns:
            Embedding vector as list of floats
        """
        last_error: Optional[Exception] = None
        
        # Check if endpoint is /embeddings endpoint
        is_embeddings_endpoint = '/embeddings' in self.api_endpoint
        
        # Some models don't support dimensions parameter
        models_without_dimensions = ['bge-m3', 'bge-large-en', 'bge-base-en']
        supports_dimensions = self.model.lower() not in models_without_dimensions
        
        for attempt in range(self.max_retries):
            try:
                # Prepare request body
                if is_embeddings_endpoint:
                    # OpenAI embeddings format
                    request_body: Dict[str, Any] = {
                        'model': self.model,
                        'input': text,
                    }
                    if supports_dimensions and self.dimension:
                        request_body['dimensions'] = self.dimension
                else:
                    # Try compatible format
                    request_body = {
                        'model': self.model,
                        'input': text,
                    }
                    if supports_dimensions and self.dimension:
                        request_body['dimensions'] = self.dimension
                
                # Make request
                response = requests.post(
                    self.api_endpoint,
                    headers={
                        'Content-Type': 'application/json',
                        'Authorization': f'Bearer {self.api_key}',
                    },
                    json=request_body,
                    timeout=self.timeout,
                )
                
                if not response.ok:
                    error_text = response.text
                    raise Exception(
                        f'API error: {response.status_code} {response.status_text} - {error_text}'
                    )
                
                data = response.json()
                
                # Try multiple response formats
                embedding_array: Optional[List[float]] = None
                
                # Format 1: OpenAI embeddings format { data: [{ embedding: [...] }] }
                if data.get('data') and isinstance(data['data'], list) and len(data['data']) > 0:
                    if 'embedding' in data['data'][0]:
                        embedding_array = data['data'][0]['embedding']
                
                # Format 2: Direct { embedding: [...] }
                elif 'embedding' in data:
                    embedding_array = data['embedding']
                
                # Format 3: Array format [{ embedding: [...] }]
                elif isinstance(data, list) and len(data) > 0:
                    if 'embedding' in data[0]:
                        embedding_array = data[0]['embedding']
                
                if not embedding_array or not isinstance(embedding_array, list):
                    raise Exception(
                        'Invalid embedding response format. Expected array of numbers.'
                    )
                
                return embedding_array
                
            except Exception as e:
                last_error = e
                if attempt < self.max_retries - 1:
                    # Exponential backoff
                    delay = 1.0 * (attempt + 1)
                    time.sleep(delay)
                else:
                    raise
        
        raise last_error or Exception('Failed to call embedding API')
    
    def _normalize_vector(self, vec: List[float]) -> np.ndarray:
        """
        Normalize vector to unit length (for cosine similarity)
        
        Args:
            vec: Vector as list of floats
            
        Returns:
            Normalized vector as numpy array
        """
        vec_array = np.array(vec, dtype=np.float32)
        magnitude = np.linalg.norm(vec_array)
        
        if magnitude == 0:
            return vec_array
        
        return vec_array / magnitude
    
    def get_model(self) -> str:
        """Get the model name"""
        return self.model
    
    def get_dimension(self) -> int:
        """Get the dimension"""
        return self.dimension

