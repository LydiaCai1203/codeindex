"""管理 Node Worker 进程"""

from __future__ import annotations

import json
import os
import subprocess
import threading
import time
from pathlib import Path
from typing import Any, Dict, Optional

from .exceptions import (
    CodeIndexSDKError,
    NodeRuntimeError,
    WorkerCrashedError,
    RequestTimeoutError,
)


class NodeWorker:
    """通过 stdin/stdout 与 Node Worker 通信"""

    def __init__(
        self,
        worker_script: Path,
        node_command: str = "node",
        env: Optional[Dict[str, str]] = None,
    ) -> None:
        self.worker_script = worker_script
        self.node_command = node_command
        self.env = env or {}
        self._proc: Optional[subprocess.Popen[str]] = None
        self._lock = threading.Lock()
        self._req_id = 0

    def start(self) -> None:
        if self._proc and self._proc.poll() is None:
            return

        if not self.worker_script.exists():
            raise NodeRuntimeError(f"找不到 worker_server.js: {self.worker_script}")

        cmd = [self.node_command, str(self.worker_script)]
        env = os.environ.copy()
        env.update(self.env)
        try:
            self._proc = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
            )
        except FileNotFoundError as exc:
            raise NodeRuntimeError("启动 Node 失败，请确认已安装 node") from exc

        # 后台线程打印 stderr，便于调试
        threading.Thread(
            target=self._drain_stderr,
            name="codeindex-worker-stderr",
            daemon=True,
        ).start()

    def stop(self, timeout: float = 5.0) -> None:
        if not self._proc:
            return
        try:
            self.request("shutdown", {}, timeout=timeout)
        except Exception:
            pass
        finally:
            if self._proc and self._proc.poll() is None:
                self._proc.terminate()
            self._proc = None

    def request(self, method: str, params: Dict[str, Any], timeout: float = 30.0) -> Any:
        if not self._proc or self._proc.poll() is not None:
            raise WorkerCrashedError("Worker 未运行或已退出")

        if not self._proc.stdin or not self._proc.stdout:
            raise WorkerCrashedError("Worker 管道不可用")

        with self._lock:
            self._req_id += 1
            req_id = self._req_id
            payload = json.dumps({"id": req_id, "method": method, "params": params})
            self._proc.stdin.write(payload + "\n")
            self._proc.stdin.flush()

            start = time.time()
            while True:
                if timeout and (time.time() - start) > timeout:
                    raise RequestTimeoutError(f"请求 {method} 超时")

                line = self._proc.stdout.readline()
                if line == "":
                    raise WorkerCrashedError("Worker stdout 已关闭")

                try:
                    message = json.loads(line)
                except json.JSONDecodeError:
                    continue

                if message.get("id") != req_id:
                    continue

                if message.get("error"):
                    raise CodeIndexSDKError(str(message["error"]))
                return message.get("result")

    def _drain_stderr(self) -> None:
        if not self._proc or not self._proc.stderr:
            return
        for line in self._proc.stderr:
            line = line.rstrip()
            if line:
                print(f"[CodeIndex Worker] {line}")

