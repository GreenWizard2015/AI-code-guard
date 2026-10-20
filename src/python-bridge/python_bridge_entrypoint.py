from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, BinaryIO, TextIO

from implementation.ast.python_ast_bridge import PythonAstBridge
from implementation.ast.python_ast_tree import PythonAstTree
from protocols import PythonAstBridgeContract
from protocols import PythonBridgeInputContract
from implementation.types import JsonObject
from python_batch_result import PythonBatchResult
from python_bridge_arguments import PythonBridgeArguments
from path_python_bridge_file_io import PathPythonBridgeFileIO
from python_bridge_input import PythonBridgeInput
from python_bridge_output import PythonBridgeOutput


class PythonBridgeEntrypoint:
    """Responsibilities: _bridge request processing_, _mode-specific response writing_."""

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
        return json.loads(payload)

    def _worker_write(self, output_buffer: BinaryIO, result: JsonObject) -> None:
        """Responsibilities: _encode worker result newline-delimited_."""
        payload = json.dumps(result, separators=(",", ":")).encode("utf-8")
        output_buffer.write(str(len(payload)).encode("ascii"))
        output_buffer.write(b"\n")
        output_buffer.write(payload)
        output_buffer.write(b"\n")
        output_buffer.flush()

    def _worker_batch(self, request: JsonObject, output_buffer: BinaryIO) -> None:
        """Responsibilities: _batch request parsing_."""
        batch = PythonBatchResult(request["batchId"])
        sources: dict[str, str] = request["sources"]
        for name, source in sources.items():
            batch.add(name, self.bridge.source_ast_timed(source))
        self._worker_write(output_buffer, batch.result())

    def __init__(
        self,
        bridge: PythonAstBridgeContract,
        input_stream: TextIO,
        output_stream: TextIO,
        input_source: PythonBridgeInputContract,
    ) -> None:
        """Responsibilities: _initialization input output streams_."""
        self.bridge: PythonAstBridgeContract = bridge
        self.input_stream: TextIO = input_stream
        self.output_stream: TextIO = output_stream
        self.output: PythonBridgeOutput = PythonBridgeOutput(output_stream)
        self.input_source: PythonBridgeInputContract = input_source

    def run(self) -> None:
        """Responsibilities: _configuration bridge execution dispatch_."""
        text: str = self.input_stream.read()
        source: str = self.input_source.resolve(text)
        result: Any = self.bridge.source_ast(source)
        self.output.write(result)

    def run_text(self, text: str) -> None:
        """Responsibilities: _source text parsing_."""
        source: Any = self.input_source.resolve(text)
        result: Any = self.bridge.source_ast(source)
        self.output.write(result)

    def run_batch(self) -> None:
        """Responsibilities: _batch request output reading_."""
        for line in self.input_stream:
            if not line.strip():
                continue
            source: Any = json.loads(line)
            result: Any = self.bridge.source_ast(self.input_source.resolve(source))
            self.output.write(result)

    def run_worker(self) -> None:
        """Responsibilities: _repeated batch requests service_."""
        input_buffer: BinaryIO = self.input_stream.buffer
        output_buffer: BinaryIO = self.output_stream.buffer
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
        bridge_arguments: Any = PythonBridgeArguments(arguments)
        if bridge_arguments.batch_mode():
            self.run_batch()
            return
        if bridge_arguments.worker_mode():
            self.run_worker()
            return
        if bridge_arguments.text_mode():
            self.run_text(self.input_stream.read())
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
