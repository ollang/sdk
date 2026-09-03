from typing import Any, Dict, List, Optional

from .._client import OllangClient


class Memories:
    """Translation memories and the items stored in them.

    A memory is a reusable store of source/target segment pairs that orders can
    draw on. Pass memory IDs to ``orders.create`` via ``selected_memories``.
    """

    def __init__(self, client: OllangClient):
        self._client = client

    def list(self) -> List[Dict[str, Any]]:
        """List all memories on the account."""
        return self._client.get("/integration/memories")

    def create(self, title: str) -> Dict[str, Any]:
        """Create an empty memory."""
        return self._client.post("/integration/memories", json={"title": title})

    def get(self, memory_id: str) -> Dict[str, Any]:
        """Retrieve a single memory by ID."""
        return self._client.get(f"/integration/memories/{memory_id}")

    def update(self, memory_id: str, title: str) -> Dict[str, Any]:
        """Rename a memory."""
        return self._client.patch(
            f"/integration/memories/{memory_id}", json={"title": title}
        )

    def delete(self, memory_id: str) -> Any:
        """Delete a memory and everything stored in it."""
        return self._client.delete(f"/integration/memories/{memory_id}")

    def import_items(
        self, memory_id: str, items: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """Import segment pairs into a memory.

        Each entry of ``items`` needs ``sourceLanguage``, ``targetLanguage``,
        ``sourceText`` and ``targetText``. Importing is asynchronous: the
        response carries a ``jobId`` you can poll with
        :meth:`get_import_job`.
        """
        return self._client.post(
            f"/integration/memories/{memory_id}/items/import", json={"items": items}
        )

    def get_import_job(self, job_id: str) -> Dict[str, Any]:
        """Check the progress of an import started by :meth:`import_items`."""
        return self._client.get(f"/integration/memories/import-jobs/{job_id}")
