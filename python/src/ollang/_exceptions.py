from typing import Any, Optional


class OllangError(Exception):
    """Base exception for all Ollang SDK errors."""


class OllangAPIError(OllangError):
    """Raised when the Ollang API returns a non-2xx response.

    Attributes:
        status_code: HTTP status code of the response.
        body: Parsed JSON body of the error response when available,
            otherwise the raw response text.
    """

    def __init__(self, message: str, status_code: Optional[int] = None, body: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.body = body
