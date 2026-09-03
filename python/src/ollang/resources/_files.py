import os
from typing import Union

PathInput = Union[str, "os.PathLike[str]"]


def save_bytes(data: bytes, path: PathInput) -> str:
    """Write binary response data to ``path`` and return the path written."""
    target = os.fspath(path)
    directory = os.path.dirname(target)
    if directory:
        os.makedirs(directory, exist_ok=True)
    with open(target, "wb") as handle:
        handle.write(data)
    return target
