import ast
import unittest
from unittest.mock import patch

from implementation.ast.annotation_resolver import AnnotationNames
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

        with patch("implementation.ast.node_index.ast.walk", wraps=ast.walk) as walk:
            first_nodes = node_index.nodes(tree)
            second_nodes = node_index.nodes(tree)

        self.assertEqual(
            {
                "reuses_nodes": first_nodes is second_nodes,
                "walk_count": walk.call_count,
            },
            {
                "reuses_nodes": True,
                "walk_count": 1,
            },
        )

    def test_rebuilds_python_ast_node_index_after_clear(self) -> None:
        """Responsibilities: _index rebuilding verification_."""
        tree = ast.parse("value = 1")
        node_index = PythonAstNodeIndex()

        with patch("implementation.ast.node_index.ast.walk", wraps=ast.walk) as walk:
            first_nodes = node_index.nodes(tree)
            cleared_indexes = node_index.clear()
            second_nodes = node_index.nodes(tree)

        self.assertEqual(
            {
                "cleared_indexes": cleared_indexes,
                "rebuilds_nodes": first_nodes is not second_nodes,
                "walk_count": walk.call_count,
            },
            {"cleared_indexes": 1, "rebuilds_nodes": True, "walk_count": 2},
        )

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
        self.assertEqual({
            "broad": "broad-except" in kinds,
            "multi": "python-multi-except" in kinds,
            "dynamic": "dynamic-type" in kinds,
            "results": "multiple-result-shapes" in kinds,
        }, {"broad": True, "multi": True, "dynamic": True, "results": True})

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
        )
        tree = ast.parse(source)
        collector = PythonCodingIssueCollector(tree, source, self._node_index())
        kinds = {issue["kind"] for issue in collector.collect()}
        self.assertIn("unnecessary-undefined-check", kinds)


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
