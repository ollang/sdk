from typing import Any, Dict, List, Optional

from .._client import OllangClient
from ._files import PathInput, save_bytes


class Orders:
    """Create and track translation orders."""

    def __init__(self, client: OllangClient):
        self._client = client

    def create(
        self,
        order_type: str,
        level: int,
        target_language_configs: List[Dict[str, Any]],
        project_id: Optional[str] = None,
        source_language: Optional[str] = None,
        content: Optional[str] = None,
        order_sub_type: Optional[str] = None,
        dubbing_style: Optional[str] = None,
        callback_url: Optional[str] = None,
        auto_qc: Optional[bool] = None,
        selected_memories: Optional[List[str]] = None,
        **extra: Any,
    ) -> List[Dict[str, Any]]:
        """Create one or more orders.

        ``order_type`` is one of ``cc``, ``subtitle``, ``document``,
        ``aiDubbing``, ``studioDubbing``, ``proofreading``, ``other`` or
        ``revision``. Each entry of ``target_language_configs`` looks like
        ``{"language": "fr", "isRush": False}``.

        ``selected_memories`` takes translation memory IDs from
        ``client.memories.list()``. ``callback_url`` receives a webhook when the
        order finishes, and ``auto_qc`` runs QC automatically on completion.

        Returns the raw API response: a list of ``{"orderId": ..., "orderType": ...}``
        entries (some order types create more than one order).
        """
        body: Dict[str, Any] = {
            "orderType": order_type,
            "level": level,
            "targetLanguageConfigs": target_language_configs,
        }
        if project_id is not None:
            body["projectId"] = project_id
        if source_language is not None:
            body["sourceLanguage"] = source_language
        if content is not None:
            body["content"] = content
        if order_sub_type is not None:
            body["orderSubType"] = order_sub_type
        if dubbing_style is not None:
            body["dubbingStyle"] = dubbing_style
        if callback_url is not None:
            body["callbackUrl"] = callback_url
        if auto_qc is not None:
            body["autoQc"] = auto_qc
        if selected_memories is not None:
            body["selectedMemories"] = selected_memories
        body.update(extra)

        return self._client.post("/integration/orders/create", json=body)

    def list(
        self,
        page: Optional[int] = None,
        take: Optional[int] = None,
        search: Optional[str] = None,
        order_by: Optional[str] = None,
        order_direction: Optional[str] = None,
        status: Optional[str] = None,
        order_type: Optional[str] = None,
        project_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """List orders with optional pagination and filters."""
        params: Dict[str, Any] = {}
        if page is not None:
            params["pageOptions[page]"] = page
        if take is not None:
            params["pageOptions[take]"] = take
        if search is not None:
            params["pageOptions[search]"] = search
        if order_by is not None:
            params["pageOptions[orderBy]"] = order_by
        if order_direction is not None:
            params["pageOptions[orderDirection]"] = order_direction
        if status is not None:
            params["filter[status]"] = status
        if order_type is not None:
            params["filter[type]"] = order_type
        if project_id is not None:
            params["filter[projectId]"] = project_id

        return self._client.get("/integration/orders", params=params)

    def get(self, order_id: str) -> Dict[str, Any]:
        return self._client.get(f"/integration/orders/{order_id}")

    def cancel(self, order_id: str) -> Any:
        return self._client.post(f"/integration/orders/cancel/{order_id}")

    def request_human_review(self, order_id: str) -> Any:
        return self._client.post(f"/integration/orders/{order_id}/human-review")

    def run_qc_evaluation(
        self,
        order_id: str,
        custom_prompt: Optional[str] = None,
        accuracy: Optional[bool] = None,
        fluency: Optional[bool] = None,
        tone: Optional[bool] = None,
        cultural_fit: Optional[bool] = None,
    ) -> Dict[str, Any]:
        body: Dict[str, Any] = {}
        if custom_prompt is not None:
            body["customPrompt"] = custom_prompt
        if accuracy is not None:
            body["accuracy"] = accuracy
        if fluency is not None:
            body["fluency"] = fluency
        if tone is not None:
            body["tone"] = tone
        if cultural_fit is not None:
            body["culturalFit"] = cultural_fit

        return self._client.post(f"/integration/orders/{order_id}/qc", json=body or None)

    def rerun(self, order_id: str, free_re_run: Optional[bool] = None) -> Dict[str, Any]:
        body = {"freeReRun": free_re_run} if free_re_run is not None else None
        return self._client.post(f"/integration/orders/{order_id}/rerun", json=body)

    def cancel_human_review(self, order_id: str) -> Any:
        """Cancel a human review previously requested for an order."""
        return self._client.post(f"/integration/orders/{order_id}/cancel-human-review")

    def request_subtitle_embedding(self, order_id: str) -> Any:
        """Request a video with the finished subtitles burned in."""
        return self._client.post(f"/integration/orders/{order_id}/subtitle-embedding")

    def review_info(self, order_id: str) -> Dict[str, Any]:
        """Inspect the review gate an order is paused at, if any.

        Reports which team tag owns the gate, the review type, when the order
        entered review, and who can clear it. Useful when an order sits in the
        ``review`` status.
        """
        return self._client.get(f"/integration/orders/{order_id}/review/info")

    def export_xlsx(self, order_id: str) -> bytes:
        """Export an order's timestamps, transcriptions and translations as XLSX.

        Returns the raw file bytes. Use :meth:`export_xlsx_to_file` to write
        them straight to disk.
        """
        return self._client.get_bytes(f"/integration/orders/{order_id}/export-xlsx")

    def export_xlsx_to_file(self, order_id: str, path: PathInput) -> str:
        """Export an order as XLSX and save the workbook to ``path``."""
        return save_bytes(self.export_xlsx(order_id), path)
