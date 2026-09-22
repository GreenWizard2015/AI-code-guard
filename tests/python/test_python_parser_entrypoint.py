import ast
import io
import json
import tempfile
import unittest
from pathlib import Path

from implementation.ast.annotation_resolver import AnnotationNames
from implementation.ast.ast_bridge import PythonAstBridge
from implementation.ast.ast_parser import PythonAstTree
from implementation.ast.node_index import PythonAstNodeIndex
from implementation.references.call_returns import CallReturns
from entrypoint import PythonBridgeEntrypoint
from bridge_input import PythonBridgeInput
from implementation.references.reference_collector import PythonReferenceCollector
from implementation.ast.symbol_nodes import PythonAstSymbolNodes


from tests.python.constants import ENTRYPOINT_SOURCE

class PythonParserMetadataTest(unittest.TestCase):
    """Responsibilities: _verification Python bridge entrypoint_."""

    def _node_index(self) -> None:
        """Responsibilities: _creation fresh AST node_."""
        return PythonAstNodeIndex()

    def test_parser_emits_entrypoint_metadata(self) -> None:
        """Responsibilities: _verification parser output includes_."""
        tree = ast.parse(ENTRYPOINT_SOURCE)
        parser = PythonAstTree(ENTRYPOINT_SOURCE)
        parsed = parser.ast()
        symbols = PythonAstSymbolNodes(tree, self._node_index())
        self.assertEqual({
            "language": parsed["language"],
            "main_guard": parsed["python_main_guard"],
            "import": parsed["python_imports"][0]["module"],
            "docstrings": len(parsed["docstring_spans"]) >= 3,
            "coding": parsed["coding_issues"],
            "holder": "Holder" in [item["name"] for item in symbols.type_declarations],
        }, {"language": "python", "main_guard": True, "import": "package", "docstrings": True, "coding": [], "holder": True})

    def test_parser_emits_metadata(self) -> None:
        """Responsibilities: _verification normalization parser metadata_."""
        tree = ast.parse(ENTRYPOINT_SOURCE)
        symbols = PythonAstSymbolNodes(tree, self._node_index())
        reference_collector = PythonReferenceCollector(tree, CallReturns(AnnotationNames()))
        references = reference_collector.collect_references()
        self.assertEqual({
            "method": any(item["kind"] == "method" for item in symbols.named_symbols),
            "reference": any(reference["name"] == "main" for reference in references),
            "docstring": bool(ast.get_docstring(tree)),
        }, {"method": True, "reference": True, "docstring": True})


    def test_runs_text_mode(self) -> None:
        """Responsibilities: _verification text bridge mode_."""
        bridge = PythonAstBridge(PythonAstTree)
        output = io.StringIO()
        entrypoint = PythonBridgeEntrypoint(bridge, io.StringIO(), output)
        entrypoint.run_text("class Item:\n    pass\n")
        result = json.loads(output.getvalue())
        self.assertEqual(result["classes"][0]["name"], "Item")

    def test_resolves_code_source_prefix(self) -> None:
        """Responsibilities: _verification code-prefixed source input_."""
        source = PythonBridgeInput()
        self.assertEqual(source.resolve("code:class Item:\n    pass\n"), "class Item:\n    pass\n")

    def test_resolves_file_source_prefix(self) -> None:
        """Responsibilities: _verification file-prefixed source input_."""
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "item.py"
            path.write_text("class Item:\n    pass\n", encoding="utf-8")
            source = PythonBridgeInput()
            resolved = source.resolve(f"File:{path}")
        self.assertEqual(resolved, "class Item:\n    pass\n")

    def test_runs_file_source_mode(self) -> None:
        """Responsibilities: _verification file source mode_."""
        bridge = PythonAstBridge(PythonAstTree)
        output = io.StringIO()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "item.py"
            path.write_text("class Item:\n    pass\n", encoding="utf-8")
            entrypoint = PythonBridgeEntrypoint(bridge, io.StringIO(f"File:{path}"), output)
            entrypoint.run_cli(["entrypoint"])
        result = json.loads(output.getvalue())
        self.assertEqual(result["classes"][0]["name"], "Item")

    def test_stream_reports_syntax(self) -> None:
        """Responsibilities: _verification stream mode reporting_."""
        bridge = PythonAstBridge(PythonAstTree)
        output = io.StringIO()
        entrypoint = PythonBridgeEntrypoint(bridge, io.StringIO("def run():\n    return None\n"), output)
        entrypoint.run_cli(["entrypoint"])
        result = json.loads(output.getvalue())
        syntax_result = bridge.source_ast("def broken(:\n    pass\n")
        self.assertEqual({
            "function": result["functions"][0]["name"],
            "syntax_line": syntax_result["parse_issues"][0]["line"],
        }, {"function": "run", "syntax_line": 0})

    def test_runs_batch_mode(self) -> None:
        """Responsibilities: _verification batch mode emits_."""
        bridge = PythonAstBridge(PythonAstTree)
        output = io.StringIO()
        entrypoint = PythonBridgeEntrypoint(
            bridge,
            io.StringIO(json.dumps("code:class First:\n    pass\n") + "\n" + json.dumps("code:def second():\n    pass\n") + "\n"),
            output,
        )
        entrypoint.run_cli(["entrypoint", "--batch"])
        results = [json.loads(line) for line in output.getvalue().splitlines()]
        self.assertEqual(
            {
                "class": results[0]["classes"][0]["name"],
                "function": results[1]["functions"][0]["name"],
            },
            {"class": "First", "function": "second"},
        )


if __name__ == "__main__":
    unittest.main()
