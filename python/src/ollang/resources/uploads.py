import json
import os
from typing import Any, BinaryIO, Dict, List, Optional, Union

from .._client import OllangClient

FileInput = Union[str, os.PathLike, bytes, BinaryIO]


def _as_file_tuple(file: FileInput, fallback_name: str):
    """Normalize a path / bytes / file object into a (name, fileobj-or-bytes) tuple."""
    if isinstance(file, (str, os.PathLike)):
        path = os.fspath(file)
        return (os.path.basename(path), open(path, "rb"))
    if isinstance(file, bytes):
        return (fallback_name, file)
    name = getattr(file, "name", None)
    return (os.path.basename(name) if isinstance(name, str) else fallback_name, file)


class Uploads:
    """Upload source files (video, audio, documents) and VTT subtitle files."""

    def __init__(self, client: OllangClient):
        self._client = client

    def direct(
        self,
        file: FileInput,
        name: str,
        source_language: str,
        notes: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """Upload a file directly, creating a project for it.

        ``file`` can be a filesystem path, raw bytes, or an open binary file
        object. ``notes`` entries look like
        ``{"details": "...", "timeStamp": "00:01:23"}``.
        """
        filename, fileobj = _as_file_tuple(file, fallback_name=name)
        data: Dict[str, Any] = {"name": name, "sourceLanguage": source_language}
        if notes is not None:
            data["notes"] = json.dumps(notes)
        try:
            return self._client.post_multipart(
                "/integration/upload/direct",
                files={"file": (filename, fileobj)},
                data=data,
            )
        finally:
            if isinstance(file, (str, os.PathLike)):
                fileobj.close()

    def vtt(self, file: FileInput, order_id: str) -> Dict[str, Any]:
        """Upload a VTT subtitle file for an existing order."""
        filename, fileobj = _as_file_tuple(file, fallback_name="subtitles.vtt")
        try:
            return self._client.post_multipart(
                "/integration/upload/vtt",
                files={"file": (filename, fileobj)},
                data={"orderId": order_id},
            )
        finally:
            if isinstance(file, (str, os.PathLike)):
                fileobj.close()
