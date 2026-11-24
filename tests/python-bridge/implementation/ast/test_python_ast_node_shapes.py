import ast
import unittest

from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.python_ast_tree import PythonAstTree


class PythonAstNodeShapesTest(unittest.TestCase):
    """Responsibilities: _AST child shape checks_, _unclassified node handling_."""

    def test_reuses_cached_direct_children(self) -> None:
        """Responsibilities: _cached direct child reuse_."""
        tree = ast.parse("value = 1\n")
        node_index = PythonAstNodeIndex()
        expected = list(ast.iter_child_nodes(tree))
        first = node_index.children(tree)
        second = node_index.children(tree)

        self.assertEqual(
            {"first": first, "second": second, "same_reference": first is second},
            {"first": expected, "second": expected, "same_reference": True},
        )

    def test_filters_non_ast_items_from_pattern_fields(self) -> None:
        """Responsibilities: _AST field child filtering_, _pattern child order_."""
        pattern = ast.MatchClass(
            cls=ast.Name(id="Point", ctx=ast.Load()),
            patterns=[],
            kwd_attrs=["x"],
            kwd_patterns=[ast.MatchAs(name="field")],
        )
        expected = list(ast.iter_child_nodes(pattern))
        node_index = PythonAstNodeIndex()
        actual = node_index.children(pattern)

        self.assertEqual(
            {"actual": actual, "expected": expected, "keyword_names": pattern.kwd_attrs},
            {"actual": expected, "expected": expected, "keyword_names": ["x"]},
        )

    def test_ignores_ast_nodes_without_coding_rules(self) -> None:
        """Responsibilities: _unclassified AST node dispatch_."""
        source = "value = 1\n"
        python_ast_tree = PythonAstTree(source, ast.parse(source))
        issues = python_ast_tree.coding_issues()
        self.assertEqual(issues, [])
