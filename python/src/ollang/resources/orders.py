from typing import Any, Dict, List, Optional

from .._client import OllangClient


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
        **extra: Any,
    ) -> List[Dict[str, Any]]:
        """Create one or more orders.

        ``order_type`` is one of ``cc``, ``subtitle``, ``document``,
        ``aiDubbing``, ``studioDubbing``, ``proofreading``, ``other`` or
        ``revision``. Each entry of ``target_language_configs`` looks like
        ``{"language": "fr", "isRush": False}``.

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
