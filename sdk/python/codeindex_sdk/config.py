"""SDK configuration (simplified for direct database access)"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Any


@dataclass
class CodeIndexConfig:
    """CodeIndex configuration (simplified, kept for backward compatibility)"""
    
    db_path: str
    # Legacy fields (kept for backward compatibility, ignored)
    root_dir: Optional[str] = None
    languages: Optional[Sequence[str]] = None
    include: Optional[Sequence[str]] = None
    exclude: Optional[Sequence[str]] = None
    batch_interval_minutes: Optional[int] = None
    min_change_lines: Optional[int] = None
    embedding_options: Optional[Dict[str, Any]] = None
    extra: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        """Validate configuration"""
        if not self.db_path:
            raise ValueError("db_path is required")
    
    def to_payload(self) -> Dict[str, Any]:
        """
        Convert to payload format (kept for backward compatibility)
        
        Note: This method is deprecated and only kept for compatibility.
        The new SDK doesn't use this payload format.
        """
        payload: Dict[str, Any] = {
            "dbPath": self.db_path,
        }
        
        # Include legacy fields for compatibility
        if self.root_dir is not None:
            payload["rootDir"] = self.root_dir
        if self.languages is not None:
            payload["languages"] = list(self.languages)
        if self.include is not None:
            payload["include"] = list(self.include)
        if self.exclude is not None:
            payload["exclude"] = list(self.exclude)
        if self.batch_interval_minutes is not None:
            payload["batchIntervalMinutes"] = self.batch_interval_minutes
        if self.min_change_lines is not None:
            payload["minChangeLines"] = self.min_change_lines
        if self.embedding_options is not None:
            payload["embeddingOptions"] = self.embedding_options
        
        if self.extra:
            payload.update(self.extra)
        
        return payload
