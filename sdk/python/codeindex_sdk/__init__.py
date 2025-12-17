"""CodeIndex Python SDK - Direct SQLite database access"""

from .client import CodeIndexClient
from .config import CodeIndexConfig
from .database import CodeIndexDatabase
from .query import CodeIndexQuery
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
    "CodeIndexClient",
    "CodeIndexConfig",
    "CodeIndexDatabase",
    "CodeIndexQuery",
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
