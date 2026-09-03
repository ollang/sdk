from typing import Any, Dict, List, Optional

from .._client import OllangClient


class Projects:
    """Create, read and list projects."""

    def __init__(self, client: OllangClient):
        self._client = client

    def get(self, project_id: str) -> Dict[str, Any]:
        return self._client.get(f"/integration/project/{project_id}")

    def list(
        self,
        page: Optional[int] = None,
        take: Optional[int] = None,
        search: Optional[str] = None,
        order_by: Optional[str] = None,
        order_direction: Optional[str] = None,
    ) -> Dict[str, Any]:
        params: Dict[str, Any] = {}
        if page is not None:
            params["page"] = page
        if take is not None:
            params["take"] = take
        if search is not None:
            params["search"] = search
        if order_by is not None:
            params["orderBy"] = order_by
        if order_direction is not None:
            params["orderDirection"] = order_direction

        return self._client.get("/integration/project", params=params)

    def create_by_url(
        self,
        url: str,
        name: str,
        source_language: str,
        folder_id: Optional[str] = None,
        notes: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """Create a project from a file the platform fetches itself.

        The file at ``url`` is downloaded server-side, so its bytes never pass
        through your process. Prefer this over ``uploads.direct`` for large
        remote files. ``notes`` entries look like
        ``{"details": "...", "timeStamp": "00:01:23"}``.
        """
        body: Dict[str, Any] = {
            "url": url,
            "name": name,
            "sourceLanguage": source_language,
        }
        if folder_id is not None:
            body["folderId"] = folder_id
        if notes is not None:
            body["notes"] = notes
        return self._client.post("/integration/project/create-by-url", json=body)
