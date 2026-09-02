from typing import Any, Dict, Optional

import requests

from ._exceptions import OllangAPIError

DEFAULT_BASE_URL = "https://api-integration.ollang.com"


class OllangClient:
    """Low-level HTTP client for the Ollang integration API.

    Handles authentication (``X-Api-Key`` header), JSON encoding/decoding,
    and error mapping. Resource classes build on top of this.
    """

    def __init__(
        self,
        api_key: str,
        base_url: Optional[str] = None,
        timeout: float = 60.0,
        session: Optional[requests.Session] = None,
    ):
        if not api_key:
            raise ValueError("api_key is required")

        self.api_key = api_key
        self.base_url = (base_url or DEFAULT_BASE_URL).rstrip("/")
        self.timeout = timeout
        self._session = session or requests.Session()
        self._session.headers.update({"X-Api-Key": api_key})

    def get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Any:
        return self._request("GET", path, params=params)

    def post(self, path: str, json: Optional[Any] = None) -> Any:
        return self._request("POST", path, json=json)

    def patch(self, path: str, json: Optional[Any] = None) -> Any:
        return self._request("PATCH", path, json=json)

    def delete(self, path: str) -> Any:
        return self._request("DELETE", path)

    def post_multipart(self, path: str, files: Dict[str, Any], data: Dict[str, Any]) -> Any:
        return self._request("POST", path, files=files, data=data)

    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        url = self.base_url + path
        response = self._session.request(method, url, timeout=self.timeout, **kwargs)

        if not response.ok:
            try:
                body = response.json()
            except ValueError:
                body = response.text
            raise OllangAPIError(
                f"Ollang API request failed: {method} {path} -> {response.status_code}",
                status_code=response.status_code,
                body=body,
            )

        if not response.content:
            return None
        try:
            return response.json()
        except ValueError:
            return response.text
