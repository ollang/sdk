from typing import Any, Dict, List, Optional

from .._client import OllangClient


class CustomInstructions:
    """Manage custom translation instructions."""

    def __init__(self, client: OllangClient):
        self._client = client

    def list(self) -> List[Dict[str, Any]]:
        return self._client.get("/integration/custom-instructions")

    def create(self, key: str, value: str, description: Optional[str] = None) -> Dict[str, Any]:
        body: Dict[str, Any] = {"key": key, "value": value}
        if description is not None:
            body["description"] = description
        return self._client.post("/integration/custom-instructions", json=body)

    def update(
        self,
        instruction_id: str,
        key: Optional[str] = None,
        value: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        body: Dict[str, Any] = {}
        if key is not None:
            body["key"] = key
        if value is not None:
            body["value"] = value
        if description is not None:
            body["description"] = description
        return self._client.patch(f"/integration/custom-instructions/{instruction_id}", json=body)

    def delete(self, instruction_id: str) -> Any:
        return self._client.delete(f"/integration/custom-instructions/{instruction_id}")

    def suggestions(self) -> List[Dict[str, Any]]:
        return self._client.get("/integration/custom-instructions/suggestions")
