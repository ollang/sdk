"""Official Python SDK for the Ollang API.

Usage:

    from ollang import Ollang

    client = Ollang(api_key="your-api-key")
    projects = client.projects.list()
"""

from typing import Any, Dict, Optional

from ._client import DEFAULT_BASE_URL, OllangClient
from ._exceptions import OllangAPIError, OllangError
from .resources import CustomInstructions, Orders, Projects, Revisions, Uploads

__version__ = "0.1.0"

__all__ = [
    "Ollang",
    "OllangClient",
    "OllangError",
    "OllangAPIError",
    "DEFAULT_BASE_URL",
    "__version__",
]


class Ollang:
    """Entry point for the Ollang API.

    Args:
        api_key: Your Ollang API key (from project settings at https://lab.ollang.com).
        base_url: Override the API base URL. Defaults to the production
            integration API.
        timeout: Request timeout in seconds (default 60).
    """

    def __init__(
        self,
        api_key: str,
        base_url: Optional[str] = None,
        timeout: float = 60.0,
    ):
        self._client = OllangClient(api_key=api_key, base_url=base_url, timeout=timeout)

        self.orders = Orders(self._client)
        self.projects = Projects(self._client)
        self.revisions = Revisions(self._client)
        self.uploads = Uploads(self._client)
        self.custom_instructions = CustomInstructions(self._client)

    def health_check(self) -> Dict[str, Any]:
        return self._client.get("/health")

    @property
    def client(self) -> OllangClient:
        """The underlying HTTP client, for calling endpoints not yet wrapped."""
        return self._client
