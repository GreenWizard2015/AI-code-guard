import ast
import io
import json
import unittest
from pathlib import Path

from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.python_ast_bridge import PythonAstBridge
from implementation.ast.python_ast_tree import PythonAstTree
from implementation.references.aliases.python_reference_aliases import (
    PythonReferenceAliases,
    PythonReferenceAliasState,
)
from path_python_bridge_file_io import PathPythonBridgeFileIO
from python_bridge_entrypoint import PythonBridgeEntrypoint
from python_bridge_input import PythonBridgeInput

from tests.python.constants import INSTANCE_SOURCE


class PythonBridgeReferenceTest(unittest.TestCase):
    """Responsibilities: _instance owner checks_, _imported alias checks_."""

    def test_reference_tracking(self) -> None:
        """Responsibilities: _reference tracking verification_."""
        output = io.StringIO()
        entrypoint = PythonBridgeEntrypoint(
            PythonAstBridge(PythonAstTree),
            io.StringIO(),
            output,
            PythonBridgeInput(PathPythonBridgeFileIO(Path())),
        )
        entrypoint.run_text(INSTANCE_SOURCE)
        parsed = json.loads(output.getvalue())
        references = parsed["references"]["call_references"]
        model_calls: list[tuple[str, str]] = []
        for reference in references:
            name = reference["name"]
            owner = reference["owner"]
            if name == "save":
                model_calls.append((name, owner))
        self.assertEqual(model_calls, [("save", "Model"), ("save", "Model")])

    def test_reference_alias_resolution_keeps_first_alias_and_reuses_index(self) -> None:
        """Responsibilities: _indexed alias resolution verification_."""
        alias_state = PythonReferenceAliasState()
        aliases = PythonReferenceAliases(alias_state)
        tree = ast.parse("import package.one as first\nimport package.two as second\n")
        node_index = PythonAstNodeIndex()
        indexed_imports = node_index.children(tree)
        aliases.collect(tree, node_index.nodes(tree))
        alias_state.aliases.append({"name": "first", "target": "ignored"})

        self.assertEqual(
            {
                "indexed_imports": indexed_imports,
                "first": aliases.resolved_name("first", frozenset()),
                "second": aliases.resolved_name("second", frozenset()),
            },
            {
                "indexed_imports": tree.body,
                "first": "package.one",
                "second": "package.two",
            },
        )
