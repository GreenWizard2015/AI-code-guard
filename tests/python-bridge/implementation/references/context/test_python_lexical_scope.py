import ast
import unittest

from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.references.context.python_lexical_scope import PythonLexicalScope


class PythonLexicalScopeTest(unittest.TestCase):
    """Responsibilities: _lexical scope cache_, _scope chain lookup_."""

    def test_caches_scope_chains_without_sharing_mutable_results(self) -> None:
        """Responsibilities: _cached scope chain storage_."""
        iterable = ast.Name(id="values", ctx=ast.Load())
        comprehension = ast.ListComp(
            elt=ast.Name(id="item", ctx=ast.Load()),
            generators=[
                ast.comprehension(
                    target=ast.Name(id="item", ctx=ast.Store()),
                    iter=iterable,
                    ifs=[],
                    is_async=0,
                ),
            ],
        )
        outer = ast.FunctionDef(
            name="outer",
            args=ast.arguments(posonlyargs=[], args=[], kwonlyargs=[], kw_defaults=[], defaults=[]),
            body=[ast.Return(value=comprehension)],
            decorator_list=[],
        )
        tree = ast.Module(body=[outer], type_ignores=[])
        index = PythonAstNodeIndex()
        index.nodes(tree)
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
        parameter = ast.arg(arg="item")
        transform = ast.Lambda(
            args=ast.arguments(posonlyargs=[], args=[parameter], kwonlyargs=[], kw_defaults=[], defaults=[]),
            body=ast.Name(id="item", ctx=ast.Load()),
        )
        assignment = ast.Assign(targets=[ast.Name(id="transform", ctx=ast.Store())], value=transform)
        method = ast.FunctionDef(
            name="convert",
            args=ast.arguments(posonlyargs=[], args=[], kwonlyargs=[], kw_defaults=[], defaults=[]),
            body=[assignment, ast.Return(value=ast.Name(id="transform", ctx=ast.Load()))],
            decorator_list=[],
        )
        container = ast.ClassDef(name="Container", bases=[], keywords=[], body=[method], decorator_list=[])
        tree = ast.Module(body=[container], type_ignores=[])
        index = PythonAstNodeIndex()
        index.nodes(tree)
        resolver = PythonLexicalScope(index)

        self.assertEqual(
            resolver.scope_chain(parameter),
            [str(id(transform)), str(id(method)), str(id(container)), "module"],
        )
