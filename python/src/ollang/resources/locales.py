from typing import Any, Dict, List, Optional
from urllib.parse import quote

from .._client import OllangClient


class Locales:
    """The platform language catalogue.

    Order and project creation match language codes exactly and reject anything
    not in the catalogue, so resolve uncertain codes here rather than guessing.
    Codes are mostly ISO 639-1 with regional and platform-specific variants
    (``pt`` is Portuguese (Brazil), ``pt-PT`` is Portugal).
    """

    def __init__(self, client: OllangClient):
        self._client = client

    def languages(self) -> List[Dict[str, Any]]:
        """List supported languages with their regional variants."""
        return self._client.get("/integration/locales/languages")

    def search(self, query: str) -> List[Dict[str, Any]]:
        """Search languages by name, native name or code."""
        return self._client.get("/integration/locales/search", params={"q": query})

    def validate(self, tag: str) -> Dict[str, Any]:
        """Check a language code against the catalogue.

        Returns whether the code is accepted, its parsed language and region,
        and why it failed if it did.
        """
        return self._client.get(f"/integration/locales/validate/{quote(tag, safe='')}")
