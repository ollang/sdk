from typing import Any, Dict, Optional

from .._client import OllangClient


class Projects:
    """Read and list projects."""

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
