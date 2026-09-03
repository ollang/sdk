from typing import Any, Dict, List, Optional

from .._client import OllangClient
from ._files import PathInput, save_bytes


class Folders:
    """Browse folders and act on every order inside them at once."""

    def __init__(self, client: OllangClient):
        self._client = client

    def list(
        self,
        page: Optional[int] = None,
        take: Optional[int] = None,
        order_by: Optional[str] = None,
        order_direction: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Dict[str, Any]:
        """List folders, with optional pagination and search."""
        params: Dict[str, Any] = {}
        if page is not None:
            params["page"] = page
        if take is not None:
            params["take"] = take
        if order_by is not None:
            params["orderBy"] = order_by
        if order_direction is not None:
            params["orderDirection"] = order_direction
        if search is not None:
            params["search"] = search
        return self._client.get("/integration/folder", params=params or None)

    def order_language_pairs(
        self, folder_id: str, status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """List the source/target language pairs of a folder's orders."""
        params = {"status": status} if status is not None else None
        return self._client.get(
            f"/integration/folder/{folder_id}/order-language-pairs", params=params
        )

    def assign_translator(
        self,
        folder_id: str,
        translator_id: str,
        deadline: Optional[str] = None,
        source_language: Optional[str] = None,
        target_language: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Assign a translator to the folder's orders.

        Narrow the assignment with ``source_language`` / ``target_language``;
        omit both to cover every order in the folder.
        """
        body: Dict[str, Any] = {"translatorId": translator_id}
        if deadline is not None:
            body["deadline"] = deadline
        if source_language is not None:
            body["sourceLanguage"] = source_language
        if target_language is not None:
            body["targetLanguage"] = target_language
        return self._client.post(
            f"/integration/folder/{folder_id}/assign-translator-to-orders", json=body
        )

    def unassign_translator(
        self,
        folder_id: str,
        source_language: Optional[str] = None,
        target_language: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Remove translator assignments from the folder's orders."""
        body: Dict[str, Any] = {}
        if source_language is not None:
            body["sourceLanguage"] = source_language
        if target_language is not None:
            body["targetLanguage"] = target_language
        return self._client.post(
            f"/integration/folder/{folder_id}/unassign-translator-from-orders",
            json=body,
        )

    def export_xlsx(
        self, folder_ids: List[str], target_languages: List[str]
    ) -> bytes:
        """Export several folders as one multi-sheet XLSX workbook.

        Returns the raw file bytes. Use :meth:`export_xlsx_to_file` to write
        them straight to disk.
        """
        return self._client.post_bytes(
            "/integration/folder/export-xlsx",
            json={"folderIds": folder_ids, "targetLanguages": target_languages},
        )

    def export_xlsx_to_file(
        self, folder_ids: List[str], target_languages: List[str], path: PathInput
    ) -> str:
        """Export folders as XLSX and save the workbook to ``path``."""
        return save_bytes(self.export_xlsx(folder_ids, target_languages), path)
