from entrypoint import PythonBridgeEntrypoint
from bridge_input import PythonBridgeInput
import ast
import unittest
from unittest.mock import patch

from implementation.ast.type_declarations.annotation_resolver import AnnotationNames
from implementation.references.call_returns import CallReturns
from implementation.ast.callable_metrics import CallableMetrics
from implementation.ast.callable_statements import CallableStatements
from implementation.ast.node_index import PythonAstNodeIndex
from implementation.ast.source_segments import SourceSegments
from implementation.rules.coding_issue_collector import PythonCodingIssueCollector
from implementation.rules.unnecessary_undefined_check import (
    PythonUnnecessaryUndefinedCheck,
)
from implementation.rules.constructor_rules import ConstructorRules
from implementation.rules.field_mutation_collector import PythonFieldMutationCollector
from implementation.rules.import_rules import ImportRules
from implementation.rules.structure_issues import StructureIssues
from implementation.references.instance_collector import PythonInstanceCollector
from implementation.references.property_type_collector import PythonPropertyTypeCollector
from implementation.references.property_type_resolver import PythonPropertyType
from implementation.references.reference_builder import PythonReference
from implementation.references.reference_context import PythonReferenceContext


from tests.python.constants import METRIC_SOURCE, CONSTRUCTOR_SOURCE, REFERENCE_SOURCE, UNDEFINED_INDEX_SOURCE

class PythonComponentsMetricsTest(unittest.TestCase):
    """Responsibilities: _Python AST components verification_."""

    def _node_index(self) -> None:
        """Responsibilities: _AST index creation_."""
        return PythonAstNodeIndex()

    def test_reuses_python_ast_node_index(self) -> None:
        """Responsibilities: _cached indexes verification_."""
        tree = ast.parse("value = 1")
        node_index = PythonAstNodeIndex()
        expected_nodes = list(ast.walk(tree))
        with patch(
            "implementation.ast.node_index.ast.iter_child_nodes",
            wraps=ast.iter_child_nodes,
        ) as children:
            first_nodes = node_index.nodes(tree)
            second_nodes = node_index.nodes(tree)
        self.assertEqual(
            {
                "same_reference": first_nodes is second_nodes,
                "nodes": first_nodes,
                "children_calls": children.call_count,
            },
            {
                "same_reference": True,
                "nodes": expected_nodes,
                "children_calls": len(expected_nodes),
            },
        )

    def test_detects_reversed_branch_comparisons(self) -> None:
        """Responsibilities: _reversed branch comparison detection_."""
        source = (
            'if kind == "a":\n'
            '    return "a"\n'
            'else:\n'
            '    if "b" == kind:\n'
            '        return "b"\n'
        )
        tree = ast.parse(source)
        node_index = self._node_index()
        structure_issues = StructureIssues(node_index)
        issues = structure_issues.repeated_branches(tree)

        self.assertEqual(issues, [{"line": 0}])

    def test_indexes_undefined_check_state_once(self) -> None:
        """Responsibilities: _undefined-check caching verification_."""
        tree = ast.parse(UNDEFINED_INDEX_SOURCE)
        comparisons = [node for node in ast.walk(tree) if type(node) is ast.Compare]

        with patch(
            "implementation.rules.undefined_check_state.ast.walk",
            wraps=ast.walk,
        ) as walk:
            check = PythonUnnecessaryUndefinedCheck(tree)
            for comparison in comparisons:
                check.collect_checks(comparison)

        self.assertEqual(walk.call_count, 2)

    def test_reuses_source_line_split_for_source_segments(self) -> None:
        """Responsibilities: _source segments verification_."""
        source = "def build():\n    value = (\n        'ёж'\n    )\n"
        node = ast.parse(source).body[0].body[0]
        segments = SourceSegments(source)

        self.assertEqual(
            segments.segment(node), ast.get_source_segment(source, node)
        )

    def test_collects_statement_metrics(self) -> None:
        """Responsibilities: _statement metrics verification_."""
        function = ast.parse(METRIC_SOURCE).body[0]
        metrics = CallableMetrics()
        self.assertGreater(metrics.statements_sloc(function.body), 10)
        self.assertGreater(metrics.statement_sloc(function.body[0]), 1)

    def test_builds_statement_shapes(self) -> None:
        """Responsibilities: _statement shapes verification_."""
        statements = CallableStatements()
        assignment = ast.parse("left = right", mode="exec").body[0]
        destructured = ast.parse("left, other = values", mode="exec").body[0]
        self.assertEqual({
            "value": statements.statement_node(assignment)["value_name"],
            "destructured": statements.statement_node(destructured)["destructured"],
            "return": statements.statement_node(ast.parse("return 1").body[0])["kind"],
        }, {"value": "right", "destructured": True, "return": "return"})


    def test_collects_constructor_issues(self) -> None:
        """Responsibilities: _diagnostics verification _."""
        tree = ast.parse(CONSTRUCTOR_SOURCE)
        constructor = ConstructorRules()
        constructor_issues = [issue for node in ast.walk(tree) for issue in constructor.collect_constructor_issues(node)]
        mutations = PythonFieldMutationCollector(tree, self._node_index())
        mutations.prepare()
        mutation_issues = [issue for node in ast.walk(tree) for issue in mutations.collect_mutations(node)]
        self.assertEqual(len(constructor_issues), 1)
        self.assertEqual({issue["kind"] for issue in mutation_issues}, {"mutable-field-assignment"})

    def test_collects_coding_issues(self) -> None:
        """Responsibilities: _coding diagnostics verification_."""
        tree = ast.parse(CONSTRUCTOR_SOURCE)
        collector = PythonCodingIssueCollector(
            tree, CONSTRUCTOR_SOURCE, self._node_index()
        )
        kinds = {issue["kind"] for issue in collector.collect()}
        standalone_source = "ready and load()\n"
        standalone_collector = PythonCodingIssueCollector(
            ast.parse(standalone_source), standalone_source, self._node_index()
        )
        standalone_kinds = {issue["kind"] for issue in standalone_collector.collect()}
        self.assertEqual({
            "broad": "broad-except" in kinds,
            "multi": "python-multi-except" in kinds,
            "dynamic": "dynamic-type" in kinds,
            "results": "multiple-result-shapes" in kinds,
        }, {"broad": True, "multi": True, "dynamic": True, "results": True})
        self.assertIn("conditional-execution", standalone_kinds)

    def test_collects_destructured_dynamic_type_alias(self) -> None:
        """Responsibilities: _dynamic type alias coverage_."""
        source = (
            "import builtins\n"
            "control = builtins.type(\"Control\", (), {})\n"
            "factory, ignored = (builtins.type, None)\n"
            "candidate = factory(\"Candidate\", (), {})\n"
            "star_factory, *ignored = (builtins.type, None, None)\n"
            "star_candidate = star_factory(\"StarCandidate\", (), {})\n"
            "candidate_type, unused = (type(\"Candidate\", (), {}), None)\n"
            "candidate_types = [type(name, (), {}) for name in (\"Candidate\",)]\n"
            "wrapped_candidate = retain(type(\"WrappedCandidate\", (), {}))\n"
            "def build_candidate():\n"
            "    return type(\"ReturnedCandidate\", (), {})\n"
        )
        tree = ast.parse(source)
        collector = PythonCodingIssueCollector(tree, source, self._node_index())
        dynamic_issues = [
            issue for issue in collector.collect() if issue["kind"] == "dynamic-type"
        ]
        self.assertEqual(len(dynamic_issues), 7)

    def test_collects_dynamic_import_from_static_container_alias(self) -> None:
        """Responsibilities: _dynamic import alias detection_."""
        source = (
            "import importlib\n"
            "def load_module():\n"
            "    loader = {'load': importlib.import_module}\n"
            "    return loader['load']('module')\n"
        )
        import_rules = ImportRules()
        issues = import_rules.import_issues(ast.parse(source))
        self.assertEqual(
            [issue["kind"] for issue in issues if issue["kind"] == "dynamic"],
            ["dynamic"],
        )

    def test_collects_dynamic_import_from_container_attribute_alias(self) -> None:
        """Responsibilities: _dynamic import object-property detection_."""
        source = (
            "import importlib\n"
            "loaders = {'module': importlib.import_module}\n"
            "module = loaders.module('example')\n"
        )
        import_rules = ImportRules()
        issues = import_rules.import_issues(ast.parse(source))
        self.assertEqual(
            [issue["kind"] for issue in issues if issue["kind"] == "dynamic"],
            ["dynamic"],
        )

    def test_collects_dynamic_import_from_builtin_mapping_callable(self) -> None:
        """Responsibilities: _dynamic import reflection aliases_."""
        source = (
            "import builtins\n"
            "import importlib\n"
            "def control(module_name: str) -> object:\n"
            "    return importlib.import_module(module_name)\n"
            "def load_module(module_name: str) -> object:\n"
            "    resolve = builtins.__dict__[\"getattr\"]\n"
            "    loader = resolve(importlib, \"import_module\")\n"
            "    return loader(module_name)\n"
        )
        import_rules = ImportRules()
        issues = import_rules.import_issues(ast.parse(source))
        self.assertEqual(
            [issue["kind"] for issue in issues if issue["kind"] == "dynamic"],
            ["dynamic", "dynamic"],
        )

    def test_collects_starred_broad_exception_alias(self) -> None:
        """Responsibilities: _starred exception alias coverage_."""
        source = (
            "import builtins\n"
            "try:\n"
            "    raise ValueError\n"
            "except builtins.Exception:\n"
            "    pass\n"
            "exception_type, *ignored = (builtins.Exception, None, None)\n"
            "try:\n"
            "    raise ValueError\n"
            "except exception_type:\n"
            "    pass\n"
        )
        tree = ast.parse(source)
        collector = PythonCodingIssueCollector(tree, source, self._node_index())
        broad_issues = [
            issue for issue in collector.collect() if issue["kind"] == "broad-except"
        ]
        self.assertEqual(len(broad_issues), 2)

    def test_collects_base_exception(self) -> None:
        """Responsibilities: _base exception diagnostics verification_."""
        source = (
            "try:\n"
            "    value = 1\n"
            "except BaseException:\n"
            "    value = 2\n"
        )
        tree = ast.parse(source)
        collector = PythonCodingIssueCollector(tree, source, self._node_index())
        kinds = {issue["kind"] for issue in collector.collect()}
        self.assertIn("broad-except", kinds)

    def test_collects_mutable_field_self_alias(self) -> None:
        """Responsibilities: _self alias mutation verification_."""
        source = (
            "class State:\n"
            "    value: int = 0\n"
            "    def update(self) -> None:\n"
            "        self_alias = self\n"
            "        self_alias.value = 1\n"
            "    def star_update(self) -> None:\n"
            "        starred_alias, *ignored = (self, None, None)\n"
            "        starred_alias.value = 2\n"
        )
        tree = ast.parse(source)
        collector = PythonFieldMutationCollector(tree, self._node_index())
        collector.prepare()
        issues = [
            issue
            for node in ast.walk(tree)
            for issue in collector.collect_mutations(node)
        ]

        self.assertEqual(
            [issue["line"] for issue in issues if issue["kind"] == "mutable-field-assignment"],
            [4, 7],
        )

    def test_rejects_unbounded_assignment_alias_boundaries(self) -> None:
        """Responsibilities: _unbounded alias boundaries verification_."""
        source = (
            "from typing import Any\n"
            "AnyAlias = Any\n"
            "\n"
            "def process(value: AnyAlias) -> AnyAlias:\n"
            "    return value\n"
            "\n"
            "unbounded_type, ignored = (Any, None)\n"
            "candidate_value: unbounded_type = None\n"
        )
        tree = ast.parse(source)
        collector = PythonCodingIssueCollector(tree, source, self._node_index())
        issues = [issue for issue in collector.collect() if issue["kind"] == "unbounded-type"]

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
        tree = ast.parse(source)
        collector = PythonCodingIssueCollector(tree, source, self._node_index())
        issues = [issue for issue in collector.collect() if issue["kind"] == "unbounded-type"]

        self.assertEqual([issue["line"] for issue in issues], [5])

    def test_rejects_string_type_annotations(self) -> None:
        """Responsibilities: _annotations verification_."""
        source = (
            "class Service:\n"
            "    model: 'Model'\n"
            "\n"
            "    def load(self, value: 'Model') -> 'Model':\n"
            "        return value\n"
        )
        tree = ast.parse(source)
        collector = PythonCodingIssueCollector(tree, source, self._node_index())
        issues = collector.collect()

        self.assertEqual(
            {
                "count": sum(issue["kind"] == "python-string-type-annotation" for issue in issues),
                "lines": [
                    issue["line"]
                    for issue in issues
                    if issue["kind"] == "python-string-type-annotation"
                ],
            },
            {"count": 3, "lines": [1, 3, 3]},
        )

    def test_rejects_none_checks_for_required_fields(self) -> None:
        """Responsibilities: _required-field checks verification_."""
        source = (
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
        tree = ast.parse(source)
        collector = PythonCodingIssueCollector(tree, source, self._node_index())
        issues = [issue for issue in collector.collect() if issue["kind"] == "unnecessary-undefined-check"]
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
        tree = ast.parse(source)
        collector = PythonCodingIssueCollector(tree, source, self._node_index())
        issues = [issue for issue in collector.collect() if issue["kind"] == "unnecessary-undefined-check"]
        self.assertEqual(len(issues), 1)

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
        tree = ast.parse(source)
        collector = PythonCodingIssueCollector(tree, source, self._node_index())
        issues = [issue for issue in collector.collect() if issue["kind"] == "unnecessary-undefined-check"]
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
        tree = ast.parse(source)
        collector = PythonCodingIssueCollector(tree, source, self._node_index())
        issues = [issue for issue in collector.collect() if issue["kind"] == "unnecessary-undefined-check"]
        self.assertEqual(len(issues), 1)


    def context(self) -> None:
        """Responsibilities: _reference context construction_."""
        tree = ast.parse(REFERENCE_SOURCE)
        aliases = {"Alias": "Model"}
        annotation_resolver = AnnotationNames()
        property_collector = PythonPropertyTypeCollector(
            tree,
            PythonPropertyType(
                aliases, {"Service", "Alias"}, annotation_resolver
            ),
            self._node_index(),
        )
        properties = property_collector.collect_properties()
        context = PythonReferenceContext(aliases, {"model": "Alias", "unknown": "Any"}, properties, {"Service.make": "Model", "make": "Factory"})
        instances = PythonInstanceCollector(tree, context)
        instances.collect_instances(AnnotationNames())
        instances.collect_for_aliases()
        return tree, context, properties

    def test_tracks_properties(self) -> None:
        """Responsibilities: _property tracking verification_."""
        _, context, properties = self.context()
        self.assertEqual({
            "current": properties["Service.current"],
            "model": properties["Service.model"],
            "owner": context.attribute_owner(ast.parse("self.current", mode="eval").body, "Service"),
            "instances": bool(context.instances),
        }, {"current": "Model", "model": "Model", "owner": "Model", "instances": True})

    def test_builds_reference_records(self) -> None:
        """Responsibilities: _reference records verification_."""
        tree, context, _ = self.context()
        builder = PythonReference(context)
        references = [CallReturns(AnnotationNames())]
        collector = PythonReference(context)
        run_call = ast.parse("run()", mode="eval").body
        service_call = ast.parse("service.run()", mode="eval").body
        bind_call = ast.parse("handler.bind", mode="eval").body
        self.assertEqual({
            "function": collector.for_call(run_call, "Service")["kind"],
            "call": collector.for_call(service_call, "Service")["is_call"],
            "expression": builder.for_expression(bind_call, 0, "Service")["name"],
            "references": len(references),
            "class": tree.body[1].name,
        }, {"function": "function", "call": True, "expression": "bind", "references": 1, "class": "Service"})


if __name__ == "__main__":
    unittest.main()
