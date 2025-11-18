"""SDK 配置定义"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Sequence, Any


@dataclass(slots=True)
class CodeIndexConfig:
    """CodeIndex Worker 初始化所需参数"""

    root_dir: str
    db_path: str
    languages: Sequence[str]
    include: Optional[Sequence[str]] = None
    exclude: Optional[Sequence[str]] = None
    batch_interval_minutes: Optional[int] = None
    min_change_lines: Optional[int] = None
    embedding_options: Optional[Dict[str, Any]] = None
    extra: Dict[str, Any] = field(default_factory=dict)

    def to_payload(self) -> Dict[str, Any]:
        # 手动构建 payload，确保字段名正确映射到 Node 端期望的格式
        payload: Dict[str, Any] = {
            "rootDir": self.root_dir,
            "dbPath": self.db_path,
            "languages": list(self.languages),
        }
        
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
        
        # 合并 extra 字段
        if self.extra:
            payload.update(self.extra)
        
        return payload

