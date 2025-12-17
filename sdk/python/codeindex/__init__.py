"""CodeIndex Python SDK - Direct SQLite database access"""

__version__ = "0.3.0"

from .client import CodeIndexClient
from .config import CodeIndexConfig
from .database import CodeIndexDatabase
from .query import CodeIndexQuery
from .embeddings_generator import EmbeddingsGenerator
from .types import (
    Location, FileRecord, SymbolRecord, CallRecord, ReferenceRecord,
    CallNode, PropertyNode, Language, SymbolKind
)
from .exceptions import (
    CodeIndexSDKError,
    DatabaseNotFoundError,
    DatabaseError,
    # Backward compatibility
    NodeRuntimeError,
    WorkerCrashedError,
    RequestTimeoutError,
)

__all__ = [
    "__version__",
    "CodeIndexClient",
    "CodeIndexConfig",
    "CodeIndexDatabase",
    "CodeIndexQuery",
    "EmbeddingsGenerator",
    "Location",
    "FileRecord",
    "SymbolRecord",
    "CallRecord",
    "ReferenceRecord",
    "CallNode",
    "PropertyNode",
    "Language",
    "SymbolKind",
    "CodeIndexSDKError",
    "DatabaseNotFoundError",
    "DatabaseError",
    # Backward compatibility
    "NodeRuntimeError",
    "WorkerCrashedError",
    "RequestTimeoutError",
]
