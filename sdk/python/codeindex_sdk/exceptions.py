"""Custom exceptions"""

class CodeIndexSDKError(RuntimeError):
    """SDK internal generic exception"""
    pass


class DatabaseNotFoundError(CodeIndexSDKError):
    """Database file not found"""
    pass


class DatabaseError(CodeIndexSDKError):
    """Database operation error"""
    pass


# Keep old exceptions for backward compatibility (deprecated)
class NodeRuntimeError(CodeIndexSDKError):
    """Node runtime not found (deprecated, kept for compatibility)"""
    pass


class WorkerCrashedError(CodeIndexSDKError):
    """Worker process crashed (deprecated, kept for compatibility)"""
    pass


class RequestTimeoutError(CodeIndexSDKError):
    """Request timeout (deprecated, kept for compatibility)"""
    pass
