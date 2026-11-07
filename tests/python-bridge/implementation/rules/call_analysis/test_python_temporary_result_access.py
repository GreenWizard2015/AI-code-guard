import ast
import unittest

from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.references.aliases.python_reference_aliases import (
    PythonReferenceAliases,
    PythonReferenceAliasState,
)
from implementation.rules.call_analysis.python_temporary_result_access import (
    PythonTemporaryResultAccess,
)


class PythonTemporaryResultAccessTest(unittest.TestCase):
    """Responsibilities: _temporary call access_, _spread access classification_."""

    def test_flags_function_call_indexing(self) -> None:
        """Responsibilities: _function result indexing_."""
        tree = ast.parse("create_values()[0]", mode="eval")
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)
        aliases = PythonReferenceAliases(PythonReferenceAliasState())
        analysis = PythonTemporaryResultAccess(aliases, node_index)
        self.assertTrue(analysis.violates(tree.body))

    def test_flags_constructor_member_access(self) -> None:
        """Responsibilities: _constructor result member access_."""
        tree = ast.parse("Reader().payload", mode="eval")
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)
        aliases = PythonReferenceAliases(PythonReferenceAliasState())
        analysis = PythonTemporaryResultAccess(aliases, node_index)
        self.assertTrue(analysis.violates(tree.body))

    def test_allows_ordinary_function_member_access(self) -> None:
        """Responsibilities: _function result member access_."""
        tree = ast.parse("resolve().payload", mode="eval")
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)
        aliases = PythonReferenceAliases(PythonReferenceAliasState())
        analysis = PythonTemporaryResultAccess(aliases, node_index)
        self.assertFalse(analysis.violates(tree.body))

    def test_flags_indexing_a_spread_copy(self) -> None:
        """Responsibilities: _spread result indexing_."""
        tree = ast.parse("[*values][0]", mode="eval")
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)
        aliases = PythonReferenceAliases(PythonReferenceAliasState())
        analysis = PythonTemporaryResultAccess(aliases, node_index)
        self.assertTrue(analysis.violates(tree.body))
