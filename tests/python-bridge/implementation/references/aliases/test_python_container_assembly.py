import ast
import unittest

from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.references.aliases.python_container_assembly import (
    PythonContainerAssembly,
)
from implementation.references.aliases.python_reference_aliases import PythonReferenceAliases
from implementation.references.data_models import PythonReferenceAliasState


class PythonContainerAssemblyCacheTest(unittest.TestCase):
    """Responsibilities: _container alias reuse_, _reference alias reuse_."""

    def test_container_aliases_reuse_scope_index_for_one_tree(self) -> None:
        """Responsibilities: _scope index reuse_."""
        tree = ast.parse("value = []\ndef read() -> None:\n    return None\n")
        node_index = PythonAstNodeIndex()
        assembly = PythonContainerAssembly(node_index)
        aliases = assembly.container_aliases()
        aliases.observe_all([tree, *ast.walk(tree)], tree)
        values = aliases.container_values()
        name = ast.Name(id="value", ctx=ast.Load())
        first = values.container_values(name)
        second = values.container_values(name)

        self.assertEqual(first, second)

    def test_reference_aliases_reuse_collection_for_one_tree(self) -> None:
        """Responsibilities: _reference alias cache_."""
        tree = ast.parse("import package.module as alias\n")
        aliases = PythonReferenceAliases(PythonReferenceAliasState())
        node_index = PythonAstNodeIndex()
        nodes = node_index.nodes(tree)
        first = aliases.collect(tree, nodes)
        second = aliases.collect(tree, nodes)

        self.assertEqual(
            {"first": first, "second": second},
            {
                "first": [{"name": "alias", "target": "package.module"}],
                "second": [{"name": "alias", "target": "package.module"}],
            },
        )
