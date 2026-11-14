import io
import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from implementation.ast.python_ast_bridge import PythonAstBridge
from implementation.ast.python_ast_tree import PythonAstTree
from implementation.types import JsonObject, JsonValue, JsonValueList, JsonValueMap
from path_python_bridge_file_io import PathPythonBridgeFileIO
from python_bridge_entrypoint import PythonBridgeEntrypoint
from python_bridge_input import PythonBridgeInput


class PythonBridgeEntrypointTest(unittest.TestCase):
    """Responsibilities: _bridge input routing_, _AST response verification_."""

    def _object(self, value: JsonValue) -> JsonObject:
        """Responsibilities: _bridge response object validation_."""
        if type(value) is dict:
            return value
        return {"invalid_object": value}

    def _json_value(self, value: JsonValue) -> JsonValue:
        """Responsibilities: _JSON value validation_."""
        if value is None or type(value) in (str, int, float, bool):
            return value
        if type(value) is list:
            return [self._json_value(item) for item in value]
        if type(value) is dict:
            return self._json_object_values(value)
        return {"invalid_json_value": type(value).__name__}

    def _json_object_values(self, value: JsonValueMap) -> JsonValueMap:
        """Responsibilities: _JSON object value validation_."""
        values: JsonValueMap = {}
        for key, item in value.items():
            values[key] = self._json_value(item)
        return values

    def _output_object(self, text: str) -> JsonObject:
        """Responsibilities: _bridge JSON response decoding_."""
        return self._object(self._json_value(json.loads(text)))

    def _first_symbol_name(self, result: JsonObject, collection: str) -> str:
        """Responsibilities: _symbol name lookup_."""
        source = self._object(result.get("source"))
        match source.get(collection):
            case list() as symbols if symbols:
                symbol = self._object(symbols[0])
            case _:
                return ""
        identity = self._object(symbol.get("identity"))
        match identity.get("name"):
            case str() as name:
                return name
            case _:
                return ""

    def _parse_issues(self, result: JsonObject) -> JsonValueList:
        """Responsibilities: _syntax diagnostic collection_."""
        source = self._object(result.get("source"))
        match source.get("parse_issues"):
            case list() as issues:
                return issues
            case _:
                return [{"invalid_parse_issues": source.get("parse_issues")}]

    def _first_parse_issue_line(self, result: JsonObject) -> int:
        """Responsibilities: _syntax diagnostic line lookup_."""
        match self._parse_issues(result):
            case [first_issue, *_]:
                issue = self._object(first_issue)
            case _:
                return -1
        match issue.get("line"):
            case int() as line if type(line) is int:
                return line
            case _:
                return -1

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
