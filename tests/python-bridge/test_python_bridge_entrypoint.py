import io
import json
import unittest
from pathlib import Path

from python_bridge_entrypoint import PythonBridgeEntrypoint
from path_python_bridge_file_io import PathPythonBridgeFileIO
from python_bridge_input import PythonBridgeInput
from implementation.ast.python_ast_bridge import PythonAstBridge
from implementation.ast.python_ast_tree import PythonAstTree


class InMemoryPythonFileIO:
    """Responsibilities: _virtual source file membership_, _source text retrieval_."""

    def __init__(self, files: dict[Path, str]) -> None:
        """Responsibilities: _virtual source map initialization_."""
        self.files: dict[Path, str] = files

    def file_present(self, path: Path) -> bool:
        """Responsibilities: _virtual source membership_."""
        return path in self.files

    def source_content(self, path: Path) -> str:
        """Responsibilities: _virtual source text retrieval_."""
        return self.files[path]


class PythonBridgeEntrypointTest(unittest.TestCase):
    """Responsibilities: _bridge input routing_, _AST response verification_."""

    def test_runs_text_mode(self) -> None:
        """Responsibilities: _text mode output_."""
        bridge = PythonAstBridge(PythonAstTree)
        output = io.StringIO()
        input_source = PythonBridgeInput(PathPythonBridgeFileIO(Path(".")))
        entrypoint = PythonBridgeEntrypoint(bridge, io.StringIO(), output, input_source)
        entrypoint.run_text("class Item:\n    pass\n")
        result = json.loads(output.getvalue())
        self.assertEqual(result["classes"][0]["name"], "Item")

    def test_resolves_code_source_prefix(self) -> None:
        """Responsibilities: _code source routing_."""
        source = PythonBridgeInput(PathPythonBridgeFileIO(Path(".")))
        self.assertEqual(source.resolve("code:class Item:\n    pass\n"), "class Item:\n    pass\n")

    def test_resolves_file_source_prefix(self) -> None:
        """Responsibilities: _file source routing_."""
        path = Path("/virtual/item.py")
        source = PythonBridgeInput(InMemoryPythonFileIO({path: "class Item:\n    pass\n"}))
        self.assertEqual(source.resolve(f"File:{path}"), "class Item:\n    pass\n")

    def test_runs_file_source_mode(self) -> None:
        """Responsibilities: _file mode output_."""
        bridge = PythonAstBridge(PythonAstTree)
        output = io.StringIO()
        path = Path("/virtual/item.py")
        source = PythonBridgeInput(InMemoryPythonFileIO({path: "class Item:\n    pass\n"}))
        entrypoint = PythonBridgeEntrypoint(bridge, io.StringIO(f"File:{path}"), output, source)
        entrypoint.run_cli(["entrypoint"])
        result = json.loads(output.getvalue())
        self.assertEqual(result["classes"][0]["name"], "Item")

    def test_stream_reports_syntax(self) -> None:
        """Responsibilities: _stream syntax reporting_."""
        bridge = PythonAstBridge(PythonAstTree)
        output = io.StringIO()
        entrypoint = PythonBridgeEntrypoint(
            bridge,
            io.StringIO("def run():\n    return None\n"),
            output,
            PythonBridgeInput(PathPythonBridgeFileIO(Path("."))),
        )
        entrypoint.run_cli(["entrypoint"])
        result = json.loads(output.getvalue())
        syntax = bridge.source_ast("def broken(:\n    pass\n")
        self.assertEqual(
            {"function": result["functions"][0]["name"], "syntax_line": syntax["parse_issues"][0]["line"]},
            {"function": "run", "syntax_line": 0},
        )

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
            PythonBridgeInput(PathPythonBridgeFileIO(Path("."))),
        )
        entrypoint.run_cli(["entrypoint", "--batch"])
        results = [json.loads(line) for line in output.getvalue().splitlines()]
        self.assertEqual(
            {"class": results[0]["classes"][0]["name"], "function": results[1]["functions"][0]["name"]},
            {"class": "First", "function": "second"},
        )
