import io
import json
import os
import pickle
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from implementation.ast.python_ast_bridge import PythonAstBridge
from implementation.ast.python_ast_tree import PythonAstTree
from implementation.types import JsonObject, JsonValueList
from path_python_bridge_file_io import PathPythonBridgeFileIO
from protocols import PythonAstBridgeContract
from python_bridge_entrypoint import PythonBridgeEntrypoint
from python_bridge_input import PythonBridgeInput
from python_ast_tree_process_probe import PythonAstTreeProcessProbe


class PythonBridgeEntrypointTest(unittest.TestCase):
    """Responsibilities: _bridge input routing_, _AST response verification_."""

    def _output_object(self, text: str) -> JsonObject:
        """Responsibilities: _bridge JSON response decoding_."""
        return json.loads(text)

    def _first_symbol_name(self, result: JsonObject, collection: str) -> str:
        """Responsibilities: _symbol name lookup_."""
        return result["source"][collection][0]["identity"]["name"]

    def _parse_issues(self, result: JsonObject) -> JsonValueList:
        """Responsibilities: _syntax diagnostic collection_."""
        return result["source"]["parse_issues"]

    def _first_parse_issue_line(self, result: JsonObject) -> int:
        """Responsibilities: _syntax diagnostic line lookup_."""
        issues = self._parse_issues(result)
        return issues[0]["line"]

    def test_runs_text_mode(self) -> None:
        """Responsibilities: _text mode output_."""
        bridge = PythonAstBridge(PythonAstTree)
        output = io.StringIO()
        input_source = PythonBridgeInput(PathPythonBridgeFileIO(Path()))
        entrypoint = PythonBridgeEntrypoint(bridge, io.StringIO(), output, input_source)
        entrypoint.run_text("class Item:\n    pass\n")
        result = self._output_object(output.getvalue())
        self.assertEqual(self._first_symbol_name(result, "classes"), "Item")

    def test_resolves_code_source_prefix(self) -> None:
        """Responsibilities: _code source routing_."""
        source = PythonBridgeInput(PathPythonBridgeFileIO(Path()))
        self.assertEqual(source.resolve("code:class Item:\n    pass\n"), "class Item:\n    pass\n")

    def test_resolves_file_source_prefix(self) -> None:
        """Responsibilities: _file source routing_."""
        with TemporaryDirectory() as temporary_directory:
            path = Path(temporary_directory) / "item.py"
            path.write_text("class Item:\n    pass\n", encoding="utf-8")
            source = PythonBridgeInput(PathPythonBridgeFileIO(Path(temporary_directory)))
            resolved = source.resolve(f"File:{path}")
        self.assertEqual(resolved, "class Item:\n    pass\n")

    def test_reads_resolved_file_path(self) -> None:
        """Responsibilities: _source file content_."""
        with TemporaryDirectory() as temporary_directory:
            path = Path(temporary_directory) / "item.py"
            path.write_text("class Item:\n    pass\n", encoding="utf-8")
            source = PythonBridgeInput(PathPythonBridgeFileIO(Path(temporary_directory)))
            content = source.file_text(path)
        self.assertEqual(content, "class Item:\n    pass\n")

    def test_runs_file_source_mode(self) -> None:
        """Responsibilities: _file mode output_."""
        bridge = PythonAstBridge(PythonAstTree)
        output = io.StringIO()
        with TemporaryDirectory() as temporary_directory:
            path = Path(temporary_directory) / "item.py"
            path.write_text("class Item:\n    pass\n", encoding="utf-8")
            source = PythonBridgeInput(PathPythonBridgeFileIO(Path(temporary_directory)))
            entrypoint = PythonBridgeEntrypoint(bridge, io.StringIO(f"File:{path}"), output, source)
            entrypoint.run_cli(["entrypoint"])
            result = self._output_object(output.getvalue())
            first_symbol_name = self._first_symbol_name(result, "classes")
        self.assertEqual(first_symbol_name, "Item")

    def test_stream_reports_syntax(self) -> None:
        """Responsibilities: _stream syntax reporting_."""
        bridge = PythonAstBridge(PythonAstTree)
        output = io.StringIO()
        entrypoint = PythonBridgeEntrypoint(
            bridge,
            io.StringIO("def broken(:\n    pass\n"),
            output,
            PythonBridgeInput(PathPythonBridgeFileIO(Path())),
        )
        entrypoint.run_cli(["entrypoint"])
        result = self._output_object(output.getvalue())
        self.assertEqual(self._first_parse_issue_line(result), 0)

    def test_runs_batch_mode(self) -> None:
        """Responsibilities: _batch response collection verification_."""
        bridge = PythonAstBridge(PythonAstTree)
        output = io.StringIO()
        sources = ["code:class First:\n    pass\n", "code:def second():\n    pass\n"]
        request = "\n".join(json.dumps(source) for source in sources) + "\n"
        entrypoint = PythonBridgeEntrypoint(
            bridge,
            io.StringIO(request),
            output,
            PythonBridgeInput(PathPythonBridgeFileIO(Path())),
        )
        entrypoint.run_cli(["entrypoint", "--batch"])
        results: list[JsonObject] = [self._output_object(line) for line in output.getvalue().splitlines()]
        self.assertEqual(
            {
                "result_count": len(results),
                "parse_issues": [self._parse_issues(item) for item in results],
                "class": self._first_symbol_name(results[0], "classes"),
                "function": self._first_symbol_name(results[1], "functions"),
            },
            {
                "result_count": 2,
                "parse_issues": [[], []],
                "class": "First",
                "function": "second",
            },
        )

    def _parallel_worker_result(
        self,
        sources: dict[str, str],
        bridge: PythonAstBridgeContract,
    ) -> JsonObject:
        """Responsibilities: _parallel worker request execution_."""
        request = json.dumps({"batch_id": "parallel-batch", "sources": sources}, separators=(",", ":")).encode()
        framed_request = str(len(request)).encode("ascii") + b"\n" + request + b"\n"
        input_buffer = io.BytesIO(framed_request)
        output_buffer = io.BytesIO()
        input_stream = io.TextIOWrapper(input_buffer, encoding="utf-8")
        output_stream = io.TextIOWrapper(output_buffer, encoding="utf-8")
        entrypoint = PythonBridgeEntrypoint(
            bridge,
            input_stream,
            output_stream,
            PythonBridgeInput(PathPythonBridgeFileIO(Path())),
        )

        entrypoint.run_worker()
        response_header, response_payload = output_buffer.getvalue().split(b"\n", maxsplit=1)
        response_length = int(response_header)
        return json.loads(response_payload[:response_length])

    def test_worker_batch_processes_large_source_sets_in_parallel_without_reordering(self) -> None:
        """Responsibilities: _parallel worker result equivalence_, _source order preservation_."""
        bridge = PythonAstBridge(PythonAstTree)
        sources = {f"source_{index:02d}.py": f"def function_{index}():\n    return {index}\n" for index in range(8)}
        response = self._parallel_worker_result(sources, bridge)
        expected = {name: bridge.source_ast(source) for name, source in sources.items()}
        response_asts = response["asts"]
        self.assertEqual(
            {"batch_id": response["batch_id"], "source_names": list(response_asts), "asts": response_asts},
            {"batch_id": "parallel-batch", "source_names": list(sources), "asts": expected},
        )

    def _parallel_sources(self, syntax_error_index: int = -1) -> dict[str, str]:
        """Responsibilities: _parallel Python source fixtures_."""
        sources: dict[str, str] = {}
        for index in range(8):
            name = f"source_{index:02d}.py"
            if index == syntax_error_index:
                sources[name] = "def broken(:\n    pass\n"
            else:
                sources[name] = f"def function_{index}():\n    return {index}\n"
        return sources

    def test_parallel_workers_run_lint_callbacks_in_bridge_process(self) -> None:
        """Responsibilities: _parser worker boundary_, _main-process rule ownership_."""
        sources = self._parallel_sources()
        bridge = PythonAstBridge(PythonAstTreeProcessProbe)
        response = self._parallel_worker_result(sources, bridge)
        response_asts = response["asts"]
        result_objects = list(response_asts.values())
        process_ids = [result_object.get("analysis_process_id") for result_object in result_objects]
        main_process_id = os.getpid()
        self.assertEqual(process_ids, [main_process_id] * len(sources))

    def test_parallel_worker_returns_completed_analysis_evidence(self) -> None:
        """Responsibilities: _completed coding issue result_, _analysis evidence_."""
        sources = self._parallel_sources()
        bridge = PythonAstBridge(PythonAstTreeProcessProbe)
        response = self._parallel_worker_result(sources, bridge)
        response_asts = response["asts"]
        result_objects = list(response_asts.values())
        issue_counts = [result_object.get("analysis_issue_count") for result_object in result_objects]
        self.assertEqual(len(issue_counts), len(sources))

    def test_bridge_parse_state_can_be_serialized(self) -> None:
        """Responsibilities: _bridge serialization_, _outcome verification_."""
        bridge = PythonAstBridge(PythonAstTree)
        serialized_bridge = pickle.dumps(bridge)
        parse_result = bridge.source_ast_input("value = 1\n")
        parse_failed = parse_result.failed()
        self.assertGreater(len(serialized_bridge), 0)
        self.assertFalse(parse_failed)

    def test_parallel_worker_preserves_syntax_error_source_order(self) -> None:
        """Responsibilities: _batch source order_, _syntax diagnostic position_."""
        sources = self._parallel_sources(syntax_error_index=3)
        bridge = PythonAstBridge(PythonAstTree)
        response = self._parallel_worker_result(sources, bridge)
        response_asts = response["asts"]
        self.assertEqual(
            {
                "source_names": list(response_asts),
                "parse_issue_line": self._first_parse_issue_line(response_asts["source_03.py"]),
            },
            {"source_names": list(sources), "parse_issue_line": 0},
        )
