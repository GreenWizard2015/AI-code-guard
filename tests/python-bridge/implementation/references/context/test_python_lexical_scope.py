import ast
import unittest

from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.references.context.python_lexical_scope import PythonLexicalScope


class PythonLexicalScopeTest(unittest.TestCase):
    """Responsibilities: _lexical scope cache_, _scope chain lookup_."""

    def test_caches_scope_chains_without_sharing_mutable_results(self) -> None:
        """Responsibilities: _cached scope chain storage_."""
        tree = ast.parse("def outer():\n    return [item for item in values]\n")
        index = PythonAstNodeIndex()
        index.nodes(tree)
        outer = tree.body[0]
        comprehension = tree.body[0].body[0].value
        iterable = comprehension.generators[0].iter
        element = comprehension.elt
        resolver = PythonLexicalScope(index)
        expected = {
            "iterable": [str(id(outer)), "module"],
            "element": [str(id(comprehension)), str(id(outer)), "module"],
        }

        iterable_chain = resolver.scope_chain(iterable)
        cached_iterable_chain = resolver._scope_chain_cache[iterable]
        iterable_chain.clear()

        self.assertEqual(
            {
                "iterable": resolver.scope_chain(iterable),
                "element": resolver.scope_chain(element),
            },
            expected,
        )
        self.assertIs(resolver._scope_chain_cache[iterable], cached_iterable_chain)

    def test_scope_chain_preserves_nested_class_and_lambda_boundaries(self) -> None:
        """Responsibilities: _nested scope traversal_."""
        tree = ast.parse(
            "class Container:\n"
            "    def convert(self):\n"
            "        transform = lambda item: item\n"
            "        return transform\n",
        )
        index = PythonAstNodeIndex()
        index.nodes(tree)
        container = tree.body[0]
        method = container.body[0]
        transform = method.body[0].value
        parameter = transform.args.args[0]
        resolver = PythonLexicalScope(index)

        self.assertEqual(
            resolver.scope_chain(parameter),
            [str(id(transform)), str(id(method)), str(id(container)), "module"],
        )
