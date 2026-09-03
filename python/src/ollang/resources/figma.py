from typing import Any, Dict, List, Optional

from .._client import OllangClient


class Figma:
    """Import Figma files and track the orders created from them."""

    def __init__(self, client: OllangClient):
        self._client = client

    def create_order(
        self,
        file_key: str,
        file_url: str,
        source_language: str,
        target_languages: List[str],
        folder_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Import a Figma file and create translation orders in one step."""
        body: Dict[str, Any] = {
            "fileKey": file_key,
            "fileUrl": file_url,
            "sourceLanguage": source_language,
            "targetLanguages": target_languages,
        }
        if folder_id is not None:
            body["folderId"] = folder_id
        return self._client.post("/integration/orders/figma/create", json=body)

    def list_orders(self, file_key: str) -> List[Dict[str, Any]]:
        """List the orders created from a given Figma file."""
        return self._client.get(
            "/integration/orders/figma", params={"fileKey": file_key}
        )

    def order_status(self, order_id: str) -> Dict[str, Any]:
        """Check the status of a single Figma order."""
        return self._client.get(f"/integration/orders/figma/{order_id}/status")
