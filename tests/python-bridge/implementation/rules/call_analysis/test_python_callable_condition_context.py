import ast
import unittest
from dataclasses import dataclass

from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.rules.call_analysis.python_callable_condition_context import (
    PythonCallableConditionContext,
)
from implementation.rules.call_analysis.python_name_binding_index import (
    PythonNameBindingIndex,
)
from implementation.rules.coding_issues.python_coding_issue_component_context import (
    PythonCodingIssueComponentContext,
)
from implementation.rules.python_syntax.python_primary_call_assembly import (
    PythonPrimaryCallAssembly,
)
from python_collector_fixture_factory import PythonCollectorFixtureOptionsFactory


@dataclass(frozen=True)
class PythonCallableConditionInputs:
    """Responsibilities: _callable node sources_, _AST parent ownership_."""

    tree: ast.Module
    node_index: PythonAstNodeIndex
    nodes: list[ast.AST]
    scopes: dict[ast.AST, str]
    parents: dict[int, ast.AST]


class PythonCallableConditionContextTest(unittest.TestCase):
    """Responsibilities: _live condition aliases_, _enclosing test classification_."""

    def _context_inputs(
        self,
        tree: ast.Module,
    ) -> PythonCallableConditionInputs:
        """Responsibilities: _AST condition index preparation_."""
        index = PythonAstNodeIndex()
        nodes = index.nodes(tree)
        scopes = index.scopes(tree)
        parents = {id(child): parent for parent in nodes for child in ast.iter_child_nodes(parent)}
        return PythonCallableConditionInputs(tree, index, nodes, scopes, parents)

    def _call(self, tree: ast.Module, name: str) -> ast.Call:
        """Responsibilities: _named call selection_."""
        for node in ast.walk(tree):
            if ast.unparse(node).startswith(name + "("):
                return node
        return ast.Call(func=ast.Name(id="", ctx=ast.Load()), args=[], keywords=[])

    def test_live_alias_in_condition_is_classified_from_ast(self) -> None:
        """Responsibilities: _live alias analysis result_."""
        tree = ast.parse(
            "def run(value):\n    enabled = callable(value)\n    if enabled:\n        perform()\n",
        )
        inputs = self._context_inputs(tree)
        context = PythonCallableConditionContext(inputs.nodes, inputs.scopes, inputs.parents)

        call = self._call(tree, "callable")
        result = context.contains_callable_condition(call)
        self.assertEqual(
            result,
            True,
        )

    def test_reassigned_alias_does_not_classify_condition_call(self) -> None:
        """Responsibilities: _reassigned alias analysis result_."""
        tree = ast.parse(
            "def run(value):\n"
            "    enabled = callable(value)\n"
            "    enabled = False\n"
            "    if enabled:\n"
            "        perform()\n",
        )
        inputs = self._context_inputs(tree)
        context = PythonCallableConditionContext(inputs.nodes, inputs.scopes, inputs.parents)

        call = self._call(tree, "callable")
        result = context.contains_callable_condition(call)
        self.assertEqual(
            result,
            False,
        )

    def test_test_function_classification_uses_enclosing_function(self) -> None:
        """Responsibilities: _test function analysis result_."""
        tree = ast.parse(
            "def test_feature():\n    verify()\ndef helper():\n    verify()\n",
        )
        inputs = self._context_inputs(tree)
        context = PythonCallableConditionContext(inputs.nodes, inputs.scopes, inputs.parents)
        calls = [tree.body[0].body[0].value, tree.body[1].body[0].value]

        self.assertEqual(
            [context.test_function(call) for call in calls],
            [True, False],
        )

    def test_condition_context_reuses_cached_ast_children(self) -> None:
        """Responsibilities: _cached AST child reuse_, _parent ownership preservation_."""
        source = "def test_run():\n    if ready():\n        perform()\n"
        tree = ast.parse(source)
        options_factory = PythonCollectorFixtureOptionsFactory()
        options = options_factory.create(tree, source)
        context = PythonCodingIssueComponentContext(options)
        context.node_index().nodes(tree)
        binding_index = PythonNameBindingIndex(tree, context.node_index())
        assembly = PythonPrimaryCallAssembly(context, binding_index)

        condition_context = assembly.condition_context()

        calls = [tree.body[0].body[0].test, tree.body[0].body[0].body[0].value]
        self.assertEqual(
            [condition_context.test_function(call) for call in calls],
            [True, True],
        )
