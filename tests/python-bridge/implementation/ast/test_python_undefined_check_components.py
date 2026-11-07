import ast
import unittest

from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.python_ast_tree import PythonAstTree
from implementation.references.aliases.python_reference_aliases import (
    PythonReferenceAliases,
    PythonReferenceAliasState,
)
from implementation.rules.coding_issues.states.alias_walk_state import AliasWalkState
from implementation.rules.coding_issues.states.python_field_mutation_collector import (
    PythonFieldMutationCollector,
)
from implementation.rules.coding_issues.states.python_inherited_fields import (
    PythonInheritedFields,
)
from implementation.rules.coding_issues.states.undefined_check_state import (
    UndefinedCheckState,
)
from implementation.rules.types import AliasWalkStateData
from implementation.types import PythonClassFieldMap


class PythonUndefinedCheckComponentsTest(unittest.TestCase):
    """Responsibilities: _field diagnostics_, _alias boundaries_."""

    """Responsibilities: _Python undefined-check component verification_."""

    def __init__(self, methodName: str = "runTest") -> None:
        """Responsibilities: _undefined-check fixture initialization_."""
        super().__init__(methodName)

    def _python_ast_node_index(self) -> PythonAstNodeIndex:
        """Responsibilities: _AST index creation_."""
        return PythonAstNodeIndex()

    def _mutable_field_alias_source(self) -> str:
        """Responsibilities: _mutable field alias source_."""
        return """class State:
    def update(self, other: State) -> None:
        self_alias = self
        self_alias._state.value = 1
        self._state[0] = 2
        other._state = 3
"""

    def test_rejects_field_writes_through_aliases_and_indices(self) -> None:
        """Responsibilities: _aliased field mutation_."""
        source = self._mutable_field_alias_source()
        tree = ast.parse(source)
        collector = PythonFieldMutationCollector()
        issues = [issue for node in ast.walk(tree) for issue in collector.collect_mutations(node)]

        self.assertEqual(
            [issue["line"] for issue in issues if issue["kind"] == "object-field-write"],
            [3, 5],
        )

    def test_rejects_unbounded_assignment_alias_boundaries(self) -> None:
        """Responsibilities: _unbounded alias boundaries verification_."""
        source = (
            "from typing import Any\n"
            "AnyAlias = Any\n"
            "\n"
            "def process(value: dict[str, list[AnyAlias]]) -> dict[str, tuple[AnyAlias]]:\n"
            "    return value\n"
            "\n"
            "unbounded_type, ignored = (Any, None)\n"
            "candidate_value: unbounded_type = None\n"
        )
        tree = PythonAstTree(source)
        issues = [issue for issue in tree.coding_issues() if issue["kind"] == "unbounded-type"]

        self.assertEqual([issue["line"] for issue in issues], [1, 3, 3, 7])

    def test_rejects_unbounded_alias_from_outer_callable(self) -> None:
        """Responsibilities: _nested callable alias resolution_."""
        source = (
            "from typing import Any\n"
            "\n"
            "def outer() -> None:\n"
            "    local_type = Any\n"
            "\n"
            "    def candidate(value: local_type) -> int:\n"
            "        return 1\n"
        )
        tree = PythonAstTree(source)
        issues = [issue for issue in tree.coding_issues() if issue["kind"] == "unbounded-type"]

        self.assertEqual(
            [issue["line"] for issue in issues],
            [5],
        )

    def test_rejects_string_type_annotations(self) -> None:
        """Responsibilities: _annotations verification_."""
        source = (
            "class Service:\n"
            "    model: 'Model'\n"
            "\n"
            "    def load(self, value: 'Model') -> 'Model':\n"
            "        return value\n"
        )
        tree = PythonAstTree(source)
        issues = tree.coding_issues()

        self.assertEqual(
            {
                "count": sum(issue["kind"] == "python-string-type-annotation" for issue in issues),
                "lines": [issue["line"] for issue in issues if issue["kind"] == "python-string-type-annotation"],
            },
            {"count": 3, "lines": [1, 3, 3]},
        )

    def _required_field_source(self) -> str:
        """Responsibilities: _required-field source setup_."""
        return (
            "class Parsed:\n"
            "    attribute_accesses: list[str]\n"
            "\n"
            "def has_attributes(parsed: Parsed) -> bool:\n"
            "    return parsed.attribute_accesses is None\n"
            "\n"
            "def has_aliased_attributes(parsed: Parsed) -> bool:\n"
            "    parsed_alias = parsed\n"
            "    nested_alias = parsed_alias\n"
            "    return nested_alias.attribute_accesses is None\n"
            "\n"
            "def has_destructured_attributes(parsed: Parsed) -> bool:\n"
            "    parsed_alias, ignored = (parsed, None)\n"
            "    return parsed_alias.attribute_accesses is None\n"
            "\n"
            "def has_starred_attributes(parsed: Parsed) -> bool:\n"
            "    parsed_alias, *ignored = (parsed, None, None)\n"
            "    return parsed_alias.attribute_accesses is None\n"
        )

    def test_rejects_none_checks_for_required_fields(self) -> None:
        """Responsibilities: _required-field checks verification_."""
        source = self._required_field_source()
        tree = PythonAstTree(source)
        issues = [issue for issue in tree.coding_issues() if issue["kind"] == "unnecessary-undefined-check"]
        self.assertEqual(len(issues), 4)

    def test_rejects_none_checks_for_inherited_required_fields(self) -> None:
        """Responsibilities: _inherited required-field checks verification_."""
        source = (
            "class ParsedBase:\n"
            "    attribute_accesses: list[str]\n"
            "\n"
            "class Parsed(ParsedBase):\n"
            "    pass\n"
            "\n"
            "def has_attributes(parsed: Parsed) -> bool:\n"
            "    return parsed.attribute_accesses is None\n"
        )
        tree = PythonAstTree(source)
        issues = [issue for issue in tree.coding_issues() if issue["kind"] == "unnecessary-undefined-check"]
        self.assertEqual(len(issues), 1)

    def _acyclic_diamond_source(self) -> str:
        """Responsibilities: _acyclic diamond source_."""
        return (
            "class LeftBase:\n"
            "    left_base: str\n"
            "\n"
            "class RightBase:\n"
            "    right_base: int\n"
            "\n"
            "class Left(LeftBase, RightBase):\n"
            "    left: bool\n"
            "\n"
            "class Right(LeftBase, RightBase):\n"
            "    right: bool\n"
            "\n"
            "class Child(Left, Right):\n"
            "    child: bytes\n"
        )

    def test_reuses_acyclic_diamond_field_resolution(self) -> None:
        """Responsibilities: _acyclic diamond cache_."""
        source = self._acyclic_diamond_source()
        tree = ast.parse(source)
        builder = UndefinedCheckState(
            {},
            {},
            PythonReferenceAliases(PythonReferenceAliasState()),
            PythonAstNodeIndex(),
        )
        fields = builder.fields_for(tree)

        self.assertEqual(
            {name: ast.unparse(value) for name, value in fields["Child"].items()},
            {
                "child": "bytes",
                "left": "bool",
                "left_base": "str",
                "right": "bool",
                "right_base": "int",
            },
        )

    def test_resolves_fields_for_classes_in_an_inheritance_cycle(self) -> None:
        """Responsibilities: _cyclic inherited-field result_."""
        tree = ast.parse(
            "class Left(Right):\n    pass\nclass Right(Left):\n    pass\n",
        )
        classes = {node.name: node for node in tree.body if type(node) is ast.ClassDef}
        own_fields: PythonClassFieldMap = {
            "Left": {"left": ast.Name(id="str", ctx=ast.Load())},
            "Right": {"right": ast.Name(id="int", ctx=ast.Load())},
        }
        inherited_fields = PythonInheritedFields(classes, own_fields)
        fields = inherited_fields.fields()

        self.assertEqual(
            {name: {field: ast.unparse(value) for field, value in values.items()} for name, values in fields.items()},
            {
                "Left": {"left": "str", "right": "int"},
                "Right": {"left": "str", "right": "int"},
            },
        )

    def test_resolves_flat_alias_chain_without_recursion_limit(self) -> None:
        """Responsibilities: _iterative alias chain resolution_."""
        aliases = [f"alias_{index}" for index in range(1200)]
        assignments: list[str] = []
        for index, name in enumerate(aliases):
            source_name = "value"
            if index:
                source_name = aliases[index - 1]
            assignments.append(f"{name} = {source_name}")
        source = "value: int = 0\n" + "\n".join(assignments)
        tree = ast.parse(source)
        builder = UndefinedCheckState(
            {},
            {},
            PythonReferenceAliases(PythonReferenceAliasState()),
            PythonAstNodeIndex(),
        )
        bindings = builder.bindings_for(tree)

        self.assertEqual(ast.unparse(bindings[aliases[-1]]), "int")

    def _alias_walk_data(self, path: list[str], positions: dict[str, int]) -> AliasWalkStateData:
        """Responsibilities: _alias traversal state_."""
        return AliasWalkStateData("first", {}, {}, {}, path, positions, ast.Constant(value=None), result_present=False)

    def test_alias_visits_reuse_linear_path_and_position_storage(self) -> None:
        """Responsibilities: _alias traversal storage reuse_."""
        path: list[str] = []
        positions: dict[str, int] = {}
        state = AliasWalkState(self._alias_walk_data(path, positions))
        snapshot = state.visit("second").visit("third").snapshot()

        self.assertEqual(
            {
                "path": snapshot.path,
                "positions": snapshot.positions,
                "reuses_path": snapshot.path is path,
                "reuses_positions": snapshot.positions is positions,
            },
            {
                "path": ["first", "second"],
                "positions": {"first": 0, "second": 1},
                "reuses_path": True,
                "reuses_positions": True,
            },
        )

    def test_alias_cycle_transition_returns_resolved_cycle_state(self) -> None:
        """Responsibilities: _alias cycle transition result_."""
        path: list[str] = []
        positions: dict[str, int] = {}
        state = AliasWalkState(self._alias_walk_data(path, positions))
        snapshot = state.visit("second").visit("first").cycle_result(0).snapshot()

        self.assertEqual(
            {
                "path": snapshot.path,
                "positions": snapshot.positions,
                "cycle_results": {name: ast.unparse(value) for name, value in snapshot.resolution_map.items()},
                "result_present": snapshot.result_present,
            },
            {
                "path": [],
                "positions": {"first": 0, "second": 1},
                "cycle_results": {"first": "None", "second": "None"},
                "result_present": True,
            },
        )

    def test_preserves_shared_tail_and_cycle_alias_results(self) -> None:
        """Responsibilities: _alias graph resolution_."""
        source = (
            "terminal: int = 0\n"
            "shared = terminal\n"
            "left = shared\n"
            "right = shared\n"
            "cycle_a = cycle_b\n"
            "cycle_b = cycle_a\n"
        )
        tree = ast.parse(source)
        builder = UndefinedCheckState(
            {},
            {},
            PythonReferenceAliases(PythonReferenceAliasState()),
            PythonAstNodeIndex(),
        )
        bindings = builder.bindings_for(tree)

        self.assertEqual(
            {name: ast.unparse(value) for name, value in bindings.items()},
            {
                "terminal": "int",
                "shared": "int",
                "left": "int",
                "right": "int",
                "cycle_a": "None",
                "cycle_b": "None",
            },
        )

    def test_undefined_check_analysis_collects_module_bindings_and_fields(self) -> None:
        """Responsibilities: _binding field analysis_."""
        tree = ast.parse(
            "class Record:\n    value: int\n\n"
            "def build(item: Record) -> Record:\n    result: Record = item\n    return result\n",
        )
        node_index = PythonAstNodeIndex()
        builder = UndefinedCheckState(
            {},
            {},
            PythonReferenceAliases(PythonReferenceAliasState()),
            node_index,
        )
        bindings = builder.bindings_for(tree)
        fields = builder.fields_for(tree)

        self.assertEqual(
            {
                "binding_names": sorted(bindings),
                "class_names": sorted(fields),
                "record_fields": sorted(fields["Record"]),
                "result_annotation": ast.unparse(bindings["result"]),
            },
            {
                "binding_names": ["item", "result", "value"],
                "class_names": ["Record"],
                "record_fields": ["value"],
                "result_annotation": "Record",
            },
        )

    def test_rejects_none_checks_for_nested_required_fields(self) -> None:
        """Responsibilities: _nested required-field checks verification_."""
        source = (
            "class Record:\n"
            "    value: int\n"
            "\n"
            "class Container:\n"
            "    record: Record\n"
            "\n"
            "def has_value(container: Container) -> bool:\n"
            "    return container.record.value is None\n"
        )
        tree = PythonAstTree(source)
        issues = [issue for issue in tree.coding_issues() if issue["kind"] == "unnecessary-undefined-check"]
        self.assertEqual(len(issues), 1)

    def test_rejects_none_checks_for_deep_nested_required_fields(self) -> None:
        """Responsibilities: _deep field state_."""
        source = (
            "class ValueHolder:\n"
            "    value: int\n"
            "\n"
            "class Record:\n"
            "    holder: ValueHolder\n"
            "\n"
            "class Container:\n"
            "    record: Record\n"
            "\n"
            "def has_value(container: Container) -> bool:\n"
            "    return container.record.holder.value is None\n"
        )
        tree = PythonAstTree(source)
        issues = [issue for issue in tree.coding_issues() if issue["kind"] == "unnecessary-undefined-check"]
        self.assertEqual(len(issues), 1)
