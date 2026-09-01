from typing import Any, Dict, List, Optional

from .._client import OllangClient


class Revisions:
    """Request revisions on completed orders."""

    def __init__(self, client: OllangClient):
        self._client = client

    def create(
        self,
        order_id: str,
        type: str,
        time: str,
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a revision request for an order.

        ``type`` is one of ``missingSubtitle``, ``wrongSubtitle``, ``syncError``,
        ``formatError`` or ``other``. ``time`` is the timestamp the revision
        refers to, e.g. ``"00:01:23"``.
        """
        body: Dict[str, Any] = {"type": type, "time": time}
        if description is not None:
            body["description"] = description
        return self._client.post(f"/integration/revision/{order_id}", json=body)

    def list(self, order_id: str) -> List[Dict[str, Any]]:
        return self._client.get(f"/integration/revision/{order_id}")

    def delete(self, order_id: str, revision_id: str) -> Any:
        return self._client.delete(f"/integration/revision/{order_id}/{revision_id}")
