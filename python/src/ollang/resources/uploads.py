import json
import os
from typing import Any, BinaryIO, Dict, List, Optional, Union

from .._client import OllangClient

FileInput = Union[str, os.PathLike, bytes, BinaryIO]


def _as_file_tuple(file: FileInput, fallback_name: str, filename: Optional[str] = None):
    """Normalize a path / bytes / file object into a (name, fileobj-or-bytes) tuple.

    The platform derives the stored file's extension from the multipart
    filename, so the name matters: raw bytes and in-memory streams carry none of
    their own, which is why ``filename`` can be passed explicitly and why the
    display name is the last resort.
    """
    if isinstance(file, (str, os.PathLike)):
        path = os.fspath(file)
        return (filename or os.path.basename(path), open(path, "rb"))
    if isinstance(file, bytes):
        return (filename or fallback_name, file)
    name = getattr(file, "name", None)
    if filename:
        return (filename, file)
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
        filename: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Upload a file directly, creating a project for it.

        ``file`` can be a filesystem path, raw bytes, or an open binary file
        object. ``notes`` entries look like
        ``{"details": "...", "timeStamp": "00:01:23"}``.

        ``name`` is the display name for the created project; it does not need
        an extension of its own. ``filename`` is the name the file is sent
        under, e.g. ``"en.json"`` — the platform takes the stored file's
        extension from it. A path supplies it; raw bytes and in-memory streams
        do not, and the API rejects an upload it cannot get an extension for.
        """
        part_name, fileobj = _as_file_tuple(file, fallback_name=name, filename=filename)
        data: Dict[str, Any] = {"name": name, "sourceLanguage": source_language}
        if notes is not None:
            data["notes"] = json.dumps(notes)
        try:
            return self._client.post_multipart(
                "/integration/upload/direct",
                files={"file": (part_name, fileobj)},
                data=data,
            )
        finally:
            if isinstance(file, (str, os.PathLike)):
                fileobj.close()

    def vtt(
        self,
        file: FileInput,
        order_id: str,
        filename: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Upload a VTT subtitle file for an existing order."""
        part_name, fileobj = _as_file_tuple(file, fallback_name="subtitles.vtt", filename=filename)
        try:
            return self._client.post_multipart(
                "/integration/upload/vtt",
                files={"file": (part_name, fileobj)},
                data={"orderId": order_id},
            )
        finally:
            if isinstance(file, (str, os.PathLike)):
                fileobj.close()

    def direct_url(
        self,
        url: str,
        name: str,
        size: int,
        source_language: str,
        folder_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Register a remote file, which the platform fetches server-side.

        Unlike :meth:`direct`, the bytes never pass through your process, so
        this has no practical file-size ceiling. ``size`` is the file's size in
        bytes, and ``url`` must be a direct link such as an S3 presigned URL.
        """
        body: Dict[str, Any] = {
            "url": url,
            "originalname": name,
            "size": size,
            "sourceLanguage": source_language,
        }
        if folder_id is not None:
            body["folderId"] = folder_id
        return self._client.post("/integration/upload/direct-url", json=body)
