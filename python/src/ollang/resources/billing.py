from typing import Any, Dict, Optional

from .._client import OllangClient


class Billing:
    """Credit balance and per-order consumption history."""

    def __init__(self, client: OllangClient):
        self._client = client

    def credits(self) -> Dict[str, Any]:
        """Retrieve the credit wallet: balance and currency."""
        return self._client.get("/integration/credits")

    def consumption(
        self,
        page: Optional[int] = None,
        take: Optional[int] = None,
        order_by: Optional[str] = None,
        order_direction: Optional[str] = None,
        search: Optional[str] = None,
        from_: Optional[str] = None,
        to: Optional[str] = None,
        provider: Optional[str] = None,
        order_type: Optional[str] = None,
        created_by: Optional[str] = None,
        order_id: Optional[str] = None,
        tag: Optional[str] = None,
    ) -> Dict[str, Any]:
        """List credit consumption entries.

        Pagination arguments map to ``pageOptions[...]`` and the filters to
        ``filter[...]`` query parameters. ``from_`` is spelled with a trailing
        underscore because ``from`` is a Python keyword; it is sent as
        ``filter[from]``.
        """
        params: Dict[str, Any] = {}
        for key, value in (
            ("page", page),
            ("take", take),
            ("orderBy", order_by),
            ("orderDirection", order_direction),
            ("search", search),
        ):
            if value is not None:
                params[f"pageOptions[{key}]"] = value
        for key, value in (
            ("search", search),
            ("from", from_),
            ("to", to),
            ("provider", provider),
            ("orderType", order_type),
            ("createdBy", created_by),
            ("orderId", order_id),
            ("tag", tag),
        ):
            if value is not None and key != "search":
                params[f"filter[{key}]"] = value
        return self._client.get("/integration/consumption", params=params or None)
