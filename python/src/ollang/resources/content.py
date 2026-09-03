from typing import Any, Dict, List, Optional

from .._client import OllangClient


class Content:
    """Import and export translation units held in your content database."""

    def __init__(self, client: OllangClient):
        self._client = client

    def import_(
        self,
        target_language: str,
        translations: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Import translation units.

        Each entry of ``translations`` needs ``sourceText`` and ``targetText``,
        and may carry ``elementId`` and ``type`` (defaults to ``text``).

        Named ``import_`` because ``import`` is a Python keyword.
        """
        return self._client.post(
            "/integration/content/import",
            json={"targetLanguage": target_language, "translations": translations},
        )

    def export(
        self,
        target_language: Optional[str] = None,
        target_languages: Optional[List[str]] = None,
        tag: Optional[str] = None,
        tags: Optional[List[str]] = None,
        order_ids: Optional[List[str]] = None,
    ) -> Any:
        """Export content translations as JSON, filtered by language, tag or order.

        List filters are sent as repeated bracket-suffixed query parameters
        (``targetLanguages[]=fr&targetLanguages[]=de``), which is the encoding
        the API expects.
        """
        params: Dict[str, Any] = {}
        if target_language is not None:
            params["targetLanguage"] = target_language
        if target_languages is not None:
            params["targetLanguages[]"] = target_languages
        if tag is not None:
            params["tag"] = tag
        if tags is not None:
            params["tags[]"] = tags
        if order_ids is not None:
            params["orderIds[]"] = order_ids
        return self._client.get("/integration/content/export", params=params or None)
