"""自定义异常"""

class CodeIndexSDKError(RuntimeError):
    """SDK 内部通用异常"""
    pass


class NodeRuntimeError(CodeIndexSDKError):
    """无法找到或启动 Node 运行时"""
    pass


class WorkerCrashedError(CodeIndexSDKError):
    """Worker 进程异常退出"""
    pass


class RequestTimeoutError(CodeIndexSDKError):
    """请求超时"""
    pass

