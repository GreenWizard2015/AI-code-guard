from __future__ import annotations


import json
from typing import TextIO
from implementation.types import JsonObject


class PythonBridgeOutput:
    """Responsibilities: _bridge results serialization_, _bridge responses writing_."""

    def _write_line(self, text: str) -> None:
        """Responsibilities: _response line writing_."""
        self.output_stream.write(text)
        self.output_stream.write("\n")
        self.output_stream.flush()

    def __init__(self, output_stream: TextIO) -> None:
        """Responsibilities: _initialization response output stream_."""
        self.output_stream: TextIO = output_stream

    def serialized(self, result: JsonObject) -> str:
        """Responsibilities: _bridge result serialization_."""
        text: str = json.dumps(result)
        if text:
            return text
        return "{}"

    def write(self, result: JsonObject) -> None:
        """Responsibilities: _output bridge result serialization_."""
        self._write_line(self.serialized(result))
