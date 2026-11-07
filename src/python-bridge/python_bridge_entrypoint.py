from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO, TextIO

from implementation.ast.python_ast_bridge import PythonAstBridge
from implementation.ast.python_ast_tree import PythonAstTree
from implementation.types import JsonObject, JsonValue
from path_python_bridge_file_io import PathPythonBridgeFileIO
from protocols import (
    PythonAstBridgeContract,
    PythonBridgeInputContract,
    PythonBridgeOutputContract,
)
from python_batch_result import PythonBatchResult
from python_bridge_arguments import PythonBridgeArguments
from python_bridge_input import PythonBridgeInput
from python_bridge_output import PythonBridgeOutput


@dataclass(frozen=True)
class PythonBatchSources:
    """Responsibilities: _batch identity_, _source text mapping_."""

    batch_id: str
    sources: dict[str, str]


class PythonBridgeEntrypoint:
    """Responsibilities: _bridge request processing_, _mode-specific response writing_."""

    def _json_value(self, value: JsonValue) -> JsonValue:
        """Responsibilities: _JSON value structure_."""
        if value is None or type(value) in (str, int, float, bool):
            return value
        if type(value) is list:
            return [self._json_value(item) for item in value]
        if type(value) is dict:
            values: dict[str, JsonValue] = {}
            for key, item in value.items():
                if type(key) is not str:
                    raise ValueError("JSON object keys must be strings.")
                values[key] = self._json_value(item)
            return values
        raise ValueError("Decoded value is outside the JSON value domain.")

    def _json_object(self, value: JsonValue) -> JsonObject:
        """Responsibilities: _JSON object shape_."""
        decoded = self._json_value(value)
        if type(decoded) is not dict:
            raise ValueError("Expected a JSON object.")
        return decoded

    def _batch_sources(self, request: JsonObject) -> PythonBatchSources:
        """Responsibilities: _worker batch input validation_."""
        batch_id = request.get("batch_id")
        if type(batch_id) is not str:
            raise ValueError("Worker batch request requires a string batch_id.")
        source_values = request.get("sources")
        if type(source_values) is not dict:
            raise ValueError("Worker batch request requires a sources object.")
        sources: dict[str, str] = {}
        for name, source in source_values.items():
            if type(source) is not str:
                raise ValueError("Worker batch sources must contain string values.")
            sources[name] = source
        return PythonBatchSources(batch_id, sources)

    def _worker_request(self, input_buffer: BinaryIO) -> JsonObject:
        """Responsibilities: _worker request decoding_."""
        header = input_buffer.readline()
        if not header:
            return {}
        if not header.strip():
            return {}
        payload_length = int(header)
        payload = input_buffer.read(payload_length)
        input_buffer.read(1)
        return self._json_object(json.loads(payload))

    def _worker_write(self, output_buffer: BinaryIO, result: JsonObject) -> None:
        """Responsibilities: _encode worker result newline-delimited_."""
        payload = json.dumps(result, separators=(",", ":")).encode("utf-8")
        output_buffer.write(str(len(payload)).encode("ascii"))
        output_buffer.write(b"\n")
        output_buffer.write(payload)
        output_buffer.write(b"\n")
        output_buffer.flush()

    def _worker_batch(self, request: JsonObject, output_buffer: BinaryIO) -> None:
        """Responsibilities: _worker batch response generation_."""
        batch_sources = self._batch_sources(request)
        batch = PythonBatchResult(batch_sources.batch_id)
        for name, source in batch_sources.sources.items():
            batch.add(name, self._bridge.source_ast_timed(source))
        self._worker_write(output_buffer, batch.result())

    def __init__(
        self,
        bridge: PythonAstBridgeContract,
        input_stream: TextIO,
        output_stream: TextIO,
        input_source: PythonBridgeInputContract,
    ) -> None:
        """Responsibilities: _initialization input output streams_."""
        self._bridge: PythonAstBridgeContract = bridge
        self._input_stream: TextIO = input_stream
        self._output_stream: TextIO = output_stream
        self._output: PythonBridgeOutputContract = PythonBridgeOutput(output_stream)
        self._input_source: PythonBridgeInputContract = input_source

    def run(self) -> None:
        """Responsibilities: _configuration bridge execution dispatch_."""
        text: str = self._input_stream.read()
        source: str = self._input_source.resolve(text)
        result = self._bridge.source_ast(source)
        self._output.write(result)

    def run_text(self, text: str) -> None:
        """Responsibilities: _source text parsing_."""
        source = self._input_source.resolve(text)
        result = self._bridge.source_ast(source)
        self._output.write(result)

    def run_batch(self) -> None:
        """Responsibilities: _batch request output reading_."""
        for line in self._input_stream:
            if not line.strip():
                continue
            decoded = self._json_value(json.loads(line))
            if type(decoded) is not str:
                raise ValueError("Batch input lines must contain JSON strings.")
            source = self._input_source.resolve(decoded)
            result = self._bridge.source_ast(source)
            self._output.write(result)

    def run_worker(self) -> None:
        """Responsibilities: _repeated batch requests service_."""
        input_buffer: BinaryIO = self._input_stream.buffer
        output_buffer: BinaryIO = self._output_stream.buffer
        while True:
            request = self._worker_request(input_buffer)
            if not request:
                return
            if request.get("command") == "exit":
                self._worker_write(output_buffer, {"status": "exited"})
                return
            self._worker_batch(request, output_buffer)

    def run_cli(self, arguments: list[str]) -> None:
        """Responsibilities: _command-line argument parsing_."""
        bridge_arguments = PythonBridgeArguments(arguments)
        if bridge_arguments.batch_mode():
            self.run_batch()
            return
        if bridge_arguments.worker_mode():
            self.run_worker()
            return
        if bridge_arguments.text_mode():
            self.run_text(self._input_stream.read())
            return
        self.run()


if __name__ == "__main__":
    bridge: PythonAstBridge = PythonAstBridge(PythonAstTree)
    entrypoint: PythonBridgeEntrypoint = PythonBridgeEntrypoint(
        bridge,
        sys.stdin,
        sys.stdout,
        PythonBridgeInput(PathPythonBridgeFileIO(Path.cwd())),
    )
    entrypoint.run_cli(sys.argv)
