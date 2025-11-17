"\"\"\"Python 侧对外暴露的客户端\"\"\""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional

from .config import CodeIndexConfig
from .node_runner import NodeWorker


class CodeIndexClient:
    def __init__(
        self,
        config: CodeIndexConfig,
        node_command: str = \"node\",
        worker_path: Optional[str] = None,
        startup_timeout: float = 30.0,
    ) -> None:
        self.config = config
        self.worker_path = (
            Path(worker_path)
            if worker_path
            else Path(__file__).resolve().parent.parent / \"worker_server.js\"
        )
        self.worker = NodeWorker(self.worker_path, node_command=node_command)
        self.startup_timeout = startup_timeout
        self._initialized = False

    def __enter__(self) -> \"CodeIndexClient\":
        self.start()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()

    def start(self) -> None:
        self.worker.start()
        self.worker.request(\"ping\", {}, timeout=5.0)
        self.worker.request(\"init\", self.config.to_payload(), timeout=self.startup_timeout)
        self._initialized = True

    def close(self) -> None:
        self.worker.stop()
        self._initialized = False

    def _ensure_running(self) -> None:
        if not self._initialized:
            self.start()

    def find_symbols(self, **query: Any) -> Any:
        self._ensure_running()
        return self.worker.request(\"find_symbols\", {\"query\": query})

    def find_symbol(self, **query: Any) -> Any:
        self._ensure_running()
        return self.worker.request(\"find_symbol\", {\"query\": query})

    def object_properties(self, object_name: str, language: Optional[str] = None) -> Any:
        self._ensure_running()
        payload: Dict[str, Any] = {\"object\": object_name}
        if language:
            payload[\"language\"] = language
        return self.worker.request(\"object_properties\", payload)

    def call_chain(self, **options: Any) -> Any:
        self._ensure_running()
        return self.worker.request(\"call_chain\", options)

    def definition(self, symbol_id: int) -> Any:
        self._ensure_running()
        return self.worker.request(\"definition\", {\"symbolId\": symbol_id})

    def references(self, symbol_id: int) -> Any:
        self._ensure_running()
        return self.worker.request(\"references\", {\"symbolId\": symbol_id})

    def semantic_search(self, **options: Any) -> Any:
        self._ensure_running()
        return self.worker.request(\"semantic_search\", options)

