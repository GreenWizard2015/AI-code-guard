import ast
import unittest

from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.python_ast_tree import PythonAstTree
from implementation.references.aliases.python_container_alias_state import (
    PythonContainerAliasState,
)
from implementation.references.aliases.python_container_aliases import (
    PythonContainerAliases,
)
from implementation.references.aliases.python_container_assembly import (
    PythonContainerAssembly,
)
from implementation.references.aliases.python_container_items import (
    PythonContainerItems,
)
from implementation.references.aliases.python_container_keys import PythonContainerKeys
from implementation.references.aliases.python_container_values import (
    PythonContainerValues,
)
from implementation.references.aliases.python_reference_aliases import (
    PythonReferenceAliases,
    PythonReferenceAliasState,
)
from implementation.references.protocols import PythonContainerAliasesContract


class PythonBridgeCollectionRuleTest(unittest.TestCase):
    """Responsibilities: _collection alias behavior_, _collection rule diagnostics_."""

    """Responsibilities: _Python AST outputs verification_."""

    def _container_alias_fixture(
        self,
        tree: ast.AST,
        index: PythonAstNodeIndex,
    ) -> PythonContainerAliasesContract:
        """Responsibilities: _container alias fixture_."""
        assembly = PythonContainerAssembly(index)
        aliases = assembly.container_aliases()
        aliases.observe_all([tree, *ast.walk(tree)], tree)
        return aliases

    def test_multiple_result_shape_subscript(self) -> None:
        """Responsibilities: _subscript result shape verification_."""
        source = 'value = result["structuredContent"]\n'
        parser = PythonAstTree(source)
        issues = parser.coding_issues()
        kinds = {issue["kind"] for issue in issues}
        self.assertIn("multiple-result-shapes", kinds)

    def test_multiple_result_shape_mapping_get(self) -> None:
        """Responsibilities: _mapping response shape verification_."""
        source = (
            "def content_from_response(response: dict[str, str]) -> str:\n"
            '    structured_content = response.get("structuredContent")\n'
            "    if structured_content is not None:\n"
            "        return structured_content\n"
            '    return response.get("unwrap_tool_result", "")\n'
            "\n"
            "def ordinary_value(response: dict[str, str]) -> str:\n"
            '    return response.get("label", "")\n'
        )
        parser = PythonAstTree(source)

        self.assertEqual(
            [issue["line"] for issue in parser.coding_issues() if issue["kind"] == "multiple-result-shapes"],
            [1, 4],
        )

    def test_container_point_lookup_returns_the_recorded_expression(self) -> None:
        """Responsibilities: _container point lookup result_."""
        state = PythonContainerAliasState(PythonAstNodeIndex())
        keys = PythonContainerKeys(state)
        items = PythonContainerItems(state, keys)
        values = PythonContainerValues(state, keys, items)
        aliases = PythonContainerAliases(state, keys, values, items)
        assignment_target = ast.Name(id="registry", ctx=ast.Store())
        assigned_mapping = ast.Dict(
            keys=[ast.Constant(value="target"), ast.Constant(value="unused")],
            values=[
                ast.Name(id="resolved", ctx=ast.Load()),
                ast.Name(id="unused", ctx=ast.Load()),
            ],
        )
        aliases.observe(ast.Assign(targets=[assignment_target], value=assigned_mapping))
        expression = ast.Subscript(
            value=ast.Name(id="registry", ctx=ast.Load()),
            slice=ast.Constant(value="target"),
            ctx=ast.Load(),
        )
        result = values.container_value(expression)
        self.assertEqual(
            (result.found(), ast.unparse(result.expression_node())),
            (True, "resolved"),
        )

    def test_container_state_owns_recorded_alias_values(self) -> None:
        """Responsibilities: _container alias value ownership_."""
        state = PythonContainerAliasState(PythonAstNodeIndex())
        item_map: dict[str, ast.AST] = {
            "target": ast.Name(id="resolved", ctx=ast.Load()),
        }
        state.record_alias("registry", "", item_map)
        item_map.clear()
        alias = state.alias("registry")
        lookup = alias.item("target")

        self.assertTrue(lookup.found())

    def test_container_alias_observation_preserves_final_lexical_scope(self) -> None:
        """Responsibilities: _container alias scope resolution_."""
        source = """\
def first():
    registry = {"first": 1}
def last():
    return first.second.third.fourth
"""
        tree = ast.parse(source)
        index = PythonAstNodeIndex()
        assembly = PythonContainerAssembly(index)
        aliases = assembly.container_aliases()
        state = aliases.state()
        aliases.observe_all(index.nodes(tree), tree)
        last_scope_values = state.alias("registry").values()
        first_function = next(node for node in tree.body if type(node) is ast.FunctionDef)
        first_assignment = first_function.body[0]
        state.select_scope_node(first_assignment)
        first_scope_values = state.alias("registry").values()

        self.assertEqual(
            {"first_scope": list(first_scope_values), "last_scope": list(last_scope_values)},
            {"first_scope": ["first"], "last_scope": []},
        )

    def test_container_aliases_follow_ast_scope_boundaries(self) -> None:
        """Responsibilities: _container alias scope behavior_."""
        tree = ast.parse("def run():\n    value = 1\n")
        node_index = PythonAstNodeIndex()
        state = PythonContainerAliasState(node_index)
        state.configure_scope_tree(tree)
        function = next(node for node in tree.body if type(node) is ast.FunctionDef)
        assignment = function.body[0]
        state.select_scope_node(tree)
        state.record_alias("registry", "", {"module": tree})
        state.select_scope_node(assignment)
        state.record_alias("registry", "", {"local": assignment})
        local_values = list(state.alias("registry").values())
        state.select_scope_node(tree)
        module_values = list(state.alias("registry").values())

        self.assertEqual(
            {"local": local_values, "module": module_values},
            {"local": ["local"], "module": ["module"]},
        )

    def test_builtin_property_alias(self) -> None:
        """Responsibilities: _builtin property alias verification_."""
        source = (
            "from builtins import property as prop\n"
            "\n"
            "class Service:\n"
            "    @prop\n"
            "    def value(self) -> int:\n"
            "        return 1\n"
        )
        parser = PythonAstTree(source)
        issues = parser.coding_issues()
        kinds = {issue["kind"] for issue in issues}
        self.assertIn("python-property", kinds)

    def test_protocol_property_declaration_is_not_a_getter_implementation(self) -> None:
        """Responsibilities: _property contract classification verification_."""
        source = (
            "from typing import Protocol\n"
            "\n"
            "class ValueContract(Protocol):\n"
            "    @property\n"
            "    def value(self) -> int: ...\n"
        )
        parser = PythonAstTree(source)
        property_issues = [issue for issue in parser.coding_issues() if issue["kind"] == "python-property"]
        self.assertEqual(property_issues, [])

    def test_collects_single_item_array_state_issue(self) -> None:
        """Responsibilities: _array state indexing verification_."""
        source = "def find_service() -> list[Service]:\n    return []\nservice = find_service()[0]\n"
        parser = PythonAstTree(source)
        issues = parser.coding_issues()
        self.assertIn("single-item-array-state", {issue["kind"] for issue in issues})

    def test_collects_zero_index_and_single_value_unpacking_without_name_assumptions(self) -> None:
        """Responsibilities: _single-item indexing_, _single-item unpacking_."""
        source = (
            "def find_service() -> list[Service]:\n"
            "    return []\n"
            "service = find_service()[0]\n"
            "context, = payload.arguments\n"
            "entry, = payload.entries\n"
        )
        parser = PythonAstTree(source)
        issues = parser.coding_issues()
        self.assertEqual(
            sorted(issue["line"] for issue in issues if issue["kind"] == "single-item-array-state"),
            [2, 3, 4],
        )

    def test_dispatches_node_rules_and_operator_precedence(self) -> None:
        """Responsibilities: _AST rule dispatch_, _precedence dispatch_."""
        source = (
            "def values() -> list[int]:\n"
            "    return []\n"
            "selected = values()[0]\n"
            "combined = left + right * other\n"
        )
        parser = PythonAstTree(source)
        kinds = {issue["kind"] for issue in parser.coding_issues()}

        self.assertIn("single-item-array-state", kinds)
        self.assertIn("mixed-arithmetic-precedence", kinds)

    def test_collects_single_item_array_state_alias(self) -> None:
        """Responsibilities: _array alias state verification_."""
        source = (
            "def find_service() -> list[Service]:\n"
            "    return []\n"
            "services = find_service()\n"
            "service = services[0]\n"
            "items_alias, ignored = (find_service, None)\n"
            "candidate = items_alias()[0]\n"
        )
        parser = PythonAstTree(source)
        issues = parser.coding_issues()
        self.assertEqual(
            [issue["line"] for issue in issues if issue["kind"] == "single-item-array-state"],
            [3, 5],
        )

    def test_indexes_alias_history_without_changing_latest_callable(self) -> None:
        """Responsibilities: _array alias history indexing_."""
        source = (
            "def find_service() -> list[Service]:\n"
            "    return []\n"
            "def find_other() -> list[Service]:\n"
            "    return []\n"
            "def read() -> None:\n"
            "    services = find_service()\n"
            "    first = services[0]\n"
            "    services = find_other()\n"
            "    second = services[0]\n"
        )
        parser = PythonAstTree(source)
        issues = parser.coding_issues()
        self.assertEqual(
            [issue["line"] for issue in issues if issue["kind"] == "single-item-array-state"],
            [6, 8],
        )

    def test_container_aliases_reuse_scope_index_for_one_tree(self) -> None:
        """Responsibilities: _scope index reuse verification_."""
        tree = ast.parse("value = []\ndef read() -> None:\n    return None\n")
        index = PythonAstNodeIndex()
        first = self._container_alias_fixture(tree, index)
        second = self._container_alias_fixture(tree, index)
        name = ast.Name(id="value", ctx=ast.Load())
        self.assertEqual(
            first.container_values().container_values(name),
            second.container_values().container_values(name),
        )

    def test_reference_aliases_reuse_collection_for_one_tree(self) -> None:
        """Responsibilities: _reference alias cache_."""
        tree = ast.parse("import package.module as alias\n")
        aliases = PythonReferenceAliases(PythonReferenceAliasState())
        node_index = PythonAstNodeIndex()
        nodes = node_index.nodes(tree)
        first = aliases.collect(tree, nodes)
        second = aliases.collect(tree, nodes)
        self.assertEqual(
            {
                "first": first,
                "second": second,
            },
            {
                "first": [{"name": "alias", "target": "package.module"}],
                "second": [{"name": "alias", "target": "package.module"}],
            },
        )
