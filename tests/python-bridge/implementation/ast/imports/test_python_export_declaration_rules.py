from __future__ import annotations

import ast
import unittest

from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.python_export_declaration_rules import PythonExportDeclarationRules


class PythonExportDeclarationRulesTest(unittest.TestCase):
    """Responsibilities: _export declaration traversal_, _export diagnostics_."""

    def test_accepts_literal_export_lists(self) -> None:
        """Responsibilities: _literal export acceptance_."""
        tree = ast.parse('__all__ = ["First", "Second"]\n')
        rules = PythonExportDeclarationRules(tree, PythonAstNodeIndex())

        self.assertEqual(rules.issues(), [])

    def test_reports_non_literal_export_assignment(self) -> None:
        """Responsibilities: _dynamic export assignment diagnostic_."""
        tree = ast.parse("if enabled:\n    __all__ = exports\n")
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)
        statement_nodes = node_index.nodes(tree.body[0])
        rules = PythonExportDeclarationRules(tree, node_index)
        issues = rules.issues()

        self.assertEqual(
            {
                "indexed_statement_count": len(statement_nodes),
                "issues": issues,
            },
            {
                "indexed_statement_count": 8,
                "issues": [{"kind": "python-all-list-assignment", "line": 1}],
            },
        )
