"""Type definitions for CodeIndex database"""

from dataclasses import dataclass
from typing import Optional, List, Literal

Language = Literal['ts', 'tsx', 'js', 'jsx', 'python', 'go', 'java', 'rust', 'html']
SymbolKind = Literal[
    'function', 'method', 'class', 'interface', 'struct',
    'variable', 'constant', 'property', 'field', 'module', 'namespace', 'type'
]
ReferenceKind = Literal['call', 'read', 'write', 'import', 'export', 'extend', 'implement']

@dataclass
class Location:
    fileId: int
    path: str
    startLine: int
    startCol: int
    endLine: int
    endCol: int

@dataclass
class FileRecord:
    fileId: Optional[int] = None
    path: str = ""
    language: Language = "go"
    contentHash: str = ""
    mtime: int = 0
    size: int = 0

@dataclass
class SymbolRecord:
    symbolId: Optional[int] = None
    fileId: int = 0
    language: Language = "go"
    kind: SymbolKind = "function"
    name: str = ""
    qualifiedName: str = ""
    startLine: int = 0
    startCol: int = 0
    endLine: int = 0
    endCol: int = 0
    signature: Optional[str] = None
    exported: bool = False
    chunkHash: Optional[str] = None
    chunkSummary: Optional[str] = None
    summaryTokens: Optional[int] = None
    summarizedAt: Optional[int] = None

@dataclass
class CallRecord:
    callId: Optional[int] = None
    callerSymbolId: int = 0
    calleeSymbolId: int = 0
    siteFileId: int = 0
    siteStartLine: int = 0
    siteStartCol: int = 0
    siteEndLine: int = 0
    siteEndCol: int = 0

@dataclass
class ReferenceRecord:
    refId: Optional[int] = None
    fromFileId: int = 0
    fromStartLine: int = 0
    fromStartCol: int = 0
    fromEndLine: int = 0
    fromEndCol: int = 0
    toSymbolId: int = 0
    refKind: ReferenceKind = "call"

@dataclass
class CallNode:
    symbolId: int
    name: str
    qualifiedName: str
    location: Location
    depth: int
    children: List['CallNode'] = None
    
    def __post_init__(self):
        if self.children is None:
            self.children = []

@dataclass
class PropertyNode:
    name: str
    kind: SymbolKind
    location: Location
    signature: Optional[str] = None

