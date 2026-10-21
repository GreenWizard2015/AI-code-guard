import ast
import unittest
from unittest.mock import patch

from implementation.ast.callables.callable_metrics import CallableMetrics
from implementation.ast.callables.callable_statements import CallableStatements
from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.python_ast_tree import PythonAstTree
from implementation.ast.imports.source_segments import SourceSegments
from implementation.rules.constructor_rules import ConstructorRules
from implementation.rules.python_field_mutation_collector import PythonFieldMutationCollector
from implementation.references.aliases.python_reference_aliases import (
    PythonReferenceAliases,
)
from implementation.references.aliases.python_container_assembly import PythonContainerAssembly
from implementation.rules.call_analysis.python_unnecessary_undefined_check import (
    PythonUnnecessaryUndefinedCheck,
)
from implementation.rules.control_flow.python_expression_boundary import (
    PythonExpressionBoundary,
)
from implementation.rules.structure_issues import StructureIssues
from implementation.rules.undefined_check_state import UndefinedCheckState

from tests.python.constants import (
    CONSTRUCTOR_SOURCE,
    METRIC_SOURCE,
    UNDEFINED_INDEX_SOURCE,
)


class PythonComponentsMetricsTest(unittest.TestCase):
    """Responsibilities: _AST component cache behavior_, _source metric collection_."""

    """Responsibilities: _Python AST components verification_."""

    def _python_ast_node_index(self) -> PythonAstNodeIndex:
        """Responsibilities: _AST index creation_."""
        return PythonAstNodeIndex()

    def test_reuses_python_ast_node_index(self) -> None:
        """Responsibilities: _cached indexes verification_."""
        tree = ast.parse("value = 1")
        python_ast_node_index = PythonAstNodeIndex()
        expected_nodes = list(ast.walk(tree))
        with patch(
            "implementation.ast.imports.python_ast_node_index.ast.iter_child_nodes",
            wraps=ast.iter_child_nodes,
        ) as children:
            first_nodes = python_ast_node_index.nodes(tree)
            second_nodes = python_ast_node_index.nodes(tree)
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

    def test_reuses_root_children_for_subtree_index(self) -> None:
        """Responsibilities: _cached subtree indexes verification_."""
        tree = ast.parse("def build():\n    value = 1\n    return value\n")
        function = tree.body[0]
        expected_nodes = list(ast.walk(tree))
        expected_function_nodes = list(ast.walk(function))
        python_ast_node_index = PythonAstNodeIndex()
        with patch(
            "implementation.ast.imports.python_ast_node_index.ast.iter_child_nodes",
            wraps=ast.iter_child_nodes,
        ) as children:
            root_nodes = python_ast_node_index.nodes(tree)
            function_nodes = python_ast_node_index.nodes(function)
        self.assertEqual(
            {"root": root_nodes, "function": function_nodes, "children_calls": children.call_count},
            {"root": expected_nodes, "function": expected_function_nodes, "children_calls": len(expected_nodes)},
        )

    def test_reuses_cached_direct_children(self) -> None:
        """Responsibilities: _cached direct child reuse_."""
        tree = ast.parse("value = 1\n")
        node_index = PythonAstNodeIndex()
        expected = list(ast.iter_child_nodes(tree))
        expected_calls = len(list(ast.walk(tree)))

        with patch(
            "implementation.ast.imports.python_ast_node_index.ast.iter_child_nodes",
            wraps=ast.iter_child_nodes,
        ) as children:
            first = node_index.children(tree)
            second = node_index.children(tree)

        self.assertEqual(
            {"first": first, "second": second, "calls": children.call_count},
            {"first": expected, "second": expected, "calls": expected_calls},
        )

    def test_children(self) -> None:
        """Responsibilities: _direct child cache_."""
        tree = ast.parse("def build():\n    value = 1\n    return value\n")
        function = tree.body[0]
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)
        with patch.object(node_index, "_subtree_nodes", wraps=node_index._subtree_nodes) as subtree:
            children = node_index.children(function)
        self.assertEqual(
            {"children": children, "subtree_calls": subtree.call_count},
            {"children": list(ast.iter_child_nodes(function)), "subtree_calls": 0},
        )

    def test_ignores_ast_nodes_without_coding_rules(self) -> None:
        """Responsibilities: _unclassified AST node dispatch_."""
        tree = ast.parse("value = 1\n")
        python_ast_tree = PythonAstTree("value = 1\n")
        issues = python_ast_tree.coding_issues()
        self.assertEqual(issues, [])

    def test_detects_reversed_branch_comparisons(self) -> None:
        """Responsibilities: _reversed branch comparison detection_."""
        source = 'if kind == "a":\n' '    return "a"\n' "else:\n" '    if "b" == kind:\n' '        return "b"\n'
        tree = ast.parse(source)
        python_ast_node_index = self._python_ast_node_index()
        structure_issues = StructureIssues(python_ast_node_index)
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
            aliases = PythonReferenceAliases()
            builder = UndefinedCheckState({}, {}, aliases)
            state = UndefinedCheckState(builder.bindings_for(tree), builder.fields_for(tree), aliases)
            check = PythonUnnecessaryUndefinedCheck(tree, state)
            for comparison in comparisons:
                check.collect_checks(comparison)

        self.assertEqual(walk.call_count, 2)

    def test_reuses_source_line_split_for_source_segments(self) -> None:
        """Responsibilities: _source segments verification_."""
        unicode_value = chr(0x0451) + chr(0x0436)
        source = "def build():\n    value = (\n        '" + unicode_value + "'\n    )\n"
        parsed_source = ast.parse(source)
        source_function = parsed_source.body[0]
        node = source_function.body[0]
        segments = SourceSegments(source)

        self.assertEqual(segments.segment(node), ast.get_source_segment(source, node))

    def test_reuses_unicode_column_mapping_for_repeated_lookups(self) -> None:
        """Responsibilities: _source column mapping reuse_."""
        unicode_value = chr(0x0451) + chr(0x0436)
        source = "value = '" + unicode_value + "'"
        segments = SourceSegments(source + "\n")

        with patch.object(
            segments,
            "_build_character_columns",
            wraps=segments._build_character_columns,
        ) as build_columns:
            first = segments.character_column(source, 9)
            second = segments.character_column(source, 11)

        self.assertEqual(
            {"first": first, "second": second, "builds": build_columns.call_count},
            {
                "first": 9,
                "second": 10,
                "builds": 1,
            },
        )

    def test_classifies_boolean_boundaries_without_rebuilding_operands(self) -> None:
        """Responsibilities: _Boolean boundary operand reuse_."""
        source = "value = flag == 0 or " + " or ".join(f"ready_{index}" for index in range(7)) + "\n"
        tree = ast.parse(source)
        expression = tree.body[0].value
        boundary = PythonExpressionBoundary(SourceSegments(source))

        with patch.object(
            boundary,
            "_simple_boolean_operand",
            wraps=boundary._simple_boolean_operand,
        ) as simple_operand:
            result = boundary.ungrouped(expression)

        self.assertEqual({"result": result, "calls": simple_operand.call_count}, {"result": True, "calls": 8})


class PythonComponentConstructionTest(unittest.TestCase):
    """Responsibilities: _AST metric collection_, _Python rule diagnostics_."""

    def test_collects_statement_metrics(self) -> None:
        """Responsibilities: _statement metrics verification_."""
        parsed_source = ast.parse(METRIC_SOURCE)
        function = parsed_source.body[0]
        metrics = CallableMetrics()
        self.assertGreater(metrics.statements_sloc(function.body), 10)
        self.assertGreater(metrics.statement_sloc(function.body[0]), 1)

    def test_builds_statement_shapes(self) -> None:
        """Responsibilities: _statement shapes verification_."""
        statements = CallableStatements()
        assignment_tree = ast.parse("left = right", mode="exec")
        assignment = assignment_tree.body[0]
        destructured_tree = ast.parse("left, other = values", mode="exec")
        destructured = destructured_tree.body[0]
        return_tree = ast.parse("return 1")
        return_statement = return_tree.body[0]
        assignment_shape = statements.statement_node(assignment)
        destructured_shape = statements.statement_node(destructured)
        return_shape = statements.statement_node(return_statement)
        self.assertEqual(
            {
                "value": assignment_shape["value_name"],
                "destructured": destructured_shape["destructured"],
                "return": return_shape["kind"],
            },
            {"value": "right", "destructured": True, "return": "return"},
        )

    def test_collects_constructor_issues(self) -> None:
        """Responsibilities: _diagnostics verification _."""
        tree = ast.parse(CONSTRUCTOR_SOURCE)
        constructor = ConstructorRules()
        constructor_issues = [
            issue for node in ast.walk(tree) for issue in constructor.collect_constructor_issues(node)
        ]
        python_ast_node_index = PythonAstNodeIndex()
        container_assembly = PythonContainerAssembly(python_ast_node_index)
        mutations = PythonFieldMutationCollector(
            tree,
            python_ast_node_index,
            container_assembly.container_aliases(),
            PythonReferenceAliases(),
        )
        mutations.prepare()
        mutation_issues = [issue for node in ast.walk(tree) for issue in mutations.collect_mutations(node)]
        self.assertEqual(len(constructor_issues), 1)
        self.assertEqual({issue["kind"] for issue in mutation_issues}, {"mutable-field-assignment"})

    def test_collects_coding_issues(self) -> None:
        """Responsibilities: _coding diagnostics verification_."""
        tree = ast.parse(CONSTRUCTOR_SOURCE)
        python_ast_tree = PythonAstTree(CONSTRUCTOR_SOURCE)
        kinds = {issue["kind"] for issue in python_ast_tree.coding_issues()}
        standalone_source = "ready and load()\n"
        standalone_tree = PythonAstTree(standalone_source)
        standalone_kinds = {issue["kind"] for issue in standalone_tree.coding_issues()}
        self.assertEqual(
            {
                "broad": "broad-except" in kinds,
                "multi": "python-multi-except" in kinds,
                "dynamic": "dynamic-type" in kinds,
                "results": "multiple-result-shapes" in kinds,
                "field_mutation": "mutable-field-assignment" in kinds,
            },
            {"broad": True, "multi": True, "dynamic": True, "results": True, "field_mutation": True},
        )
        self.assertIn("conditional-execution", standalone_kinds)

    def test_collects_destructured_dynamic_type_alias(self) -> None:
        """Responsibilities: _dynamic type alias coverage_."""
        source = (
            "import builtins\n"
            'control = builtins.type("Control", (), {})\n'
            "factory, ignored = (builtins.type, None)\n"
            'candidate = factory("Candidate", (), {})\n'
            "star_factory, *ignored = (builtins.type, None, None)\n"
            'star_candidate = star_factory("StarCandidate", (), {})\n'
            'candidate_type, unused = (type("Candidate", (), {}), None)\n'
            'candidate_types = [type(name, (), {}) for name in ("Candidate",)]\n'
            'wrapped_candidate = retain(type("WrappedCandidate", (), {}))\n'
            "def build_candidate():\n"
            '    return type("ReturnedCandidate", (), {})\n'
        )
        tree = ast.parse(source)
        python_ast_tree = PythonAstTree(source)
        dynamic_issues = [issue for issue in python_ast_tree.coding_issues() if issue["kind"] == "dynamic-type"]
        self.assertEqual(len(dynamic_issues), 7)

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
        python_ast_tree = PythonAstTree(source)
        broad_issues = [issue for issue in python_ast_tree.coding_issues() if issue["kind"] == "broad-except"]
        self.assertEqual(len(broad_issues), 2)

    def test_collects_base_exception(self) -> None:
        """Responsibilities: _base exception diagnostics verification_."""
        source = "try:\n" "    value = 1\n" "except BaseException:\n" "    value = 2\n"
        tree = ast.parse(source)
        python_ast_tree = PythonAstTree(source)
        kinds = {issue["kind"] for issue in python_ast_tree.coding_issues()}
        self.assertIn("broad-except", kinds)
