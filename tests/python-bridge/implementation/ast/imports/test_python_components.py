import ast
import unittest

from implementation.ast.callable_nodes.python_function_selector import (
    PythonFunctionSelector,
)
from implementation.ast.callables.callable_metrics import CallableMetrics
from implementation.ast.callables.callable_statements import CallableStatements
from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.imports.source_segments import SourceSegments
from implementation.ast.python_ast_tree import PythonAstTree
from implementation.references.aliases.python_reference_aliases import (
    PythonReferenceAliases,
    PythonReferenceAliasState,
)
from implementation.rules.call_analysis.python_unnecessary_undefined_check import (
    PythonUnnecessaryUndefinedCheck,
)
from implementation.rules.coding_issues.constructor_rules import ConstructorRules
from implementation.rules.coding_issues.states.python_field_mutation_collector import (
    PythonFieldMutationCollector,
)
from implementation.rules.coding_issues.states.undefined_check_state import (
    UndefinedCheckState,
)
from implementation.rules.control_flow.python_expression_boundary import (
    PythonExpressionBoundary,
)
from implementation.rules.structure_issues import StructureIssues
from implementation.types import JsonObject

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

    def _function_node(self, tree: ast.Module) -> ast.FunctionDef:
        """Responsibilities: _test function node extraction_."""
        function_node = tree.body[0]
        match function_node:
            case ast.FunctionDef() as function_definition:
                return function_definition
            case _:
                return self.fail("Expected the source tree to begin with a function definition")

    def test_reuses_python_ast_node_index(self) -> None:
        """Responsibilities: _cached indexes verification_."""
        tree = ast.parse("value = 1")
        python_ast_node_index = PythonAstNodeIndex()
        expected_nodes = list(ast.walk(tree))
        first_nodes = python_ast_node_index.nodes(tree)
        second_nodes = python_ast_node_index.nodes(tree)
        self.assertEqual(
            {
                "same_reference": first_nodes is second_nodes,
                "nodes": first_nodes,
            },
            {
                "same_reference": True,
                "nodes": expected_nodes,
            },
        )

    def test_coding_issue_timers_preserve_diagnostics(self) -> None:
        """Responsibilities: _coding issue timer stages_, _diagnostic preservation_."""
        tree = PythonAstTree('created = type("Generated", (), {})\n')

        issues = [issue["kind"] for issue in tree.coding_issues()]
        timings = tree.timings_data()

        self.assertEqual(
            {
                "dynamic_type": "dynamic-type" in issues,
                "proxy_analysis_timing": "coding-issues.proxy-analysis" in timings,
                "dispatch_overhead_timing": "coding-issues.rule-dispatch-overhead" in timings,
                "alias_preparation_timing": "coding-issues.prepare.container-aliases" in timings,
                "global_issue_timing": "coding-issues.global-issues" in timings,
                "global_collection_timing": "coding-issues.global-issues.collections" in timings,
                "collaborator_timing": "coding-issues.rule.concrete-collaborator-created-per-operation" in timings,
                "options_setup_timing": "coding-issues.setup.options" in timings,
                "components_setup_timing": "coding-issues.setup.components" in timings,
                "collector_setup_timing": "coding-issues.setup.collector" in timings,
            },
            {
                "dynamic_type": True,
                "proxy_analysis_timing": True,
                "dispatch_overhead_timing": True,
                "alias_preparation_timing": True,
                "global_issue_timing": True,
                "global_collection_timing": True,
                "collaborator_timing": True,
                "options_setup_timing": True,
                "components_setup_timing": True,
                "collector_setup_timing": True,
            },
        )

    def test_collects_each_dynamic_type_diagnostic_once(self) -> None:
        """Responsibilities: _dynamic type diagnostics collection_."""
        source = 'first = type("GeneratedFirst", (), {})\nsecond = type("GeneratedSecond", (), {})\n'
        tree = PythonAstTree(source)
        issues = tree.coding_issues()

        self.assertEqual(
            [issue["kind"] for issue in issues],
            ["dynamic-type", "dynamic-type"],
        )

    def test_reuses_root_children_for_subtree_index(self) -> None:
        """Responsibilities: _cached subtree indexes verification_."""
        tree = ast.parse("def build():\n    value = 1\n    return value\n")
        function = tree.body[0]
        expected_nodes = list(ast.walk(tree))
        expected_function_nodes = list(ast.walk(function))
        python_ast_node_index = PythonAstNodeIndex()
        root_nodes = python_ast_node_index.nodes(tree)
        function_nodes = python_ast_node_index.nodes(function)
        self.assertEqual(
            {
                "root": root_nodes,
                "function": function_nodes,
            },
            {
                "root": expected_nodes,
                "function": expected_function_nodes,
            },
        )

    def test_reuses_cached_direct_children(self) -> None:
        """Responsibilities: _cached direct child reuse_."""
        tree = ast.parse("value = 1\n")
        node_index = PythonAstNodeIndex()
        expected = list(ast.iter_child_nodes(tree))
        first = node_index.children(tree)
        second = node_index.children(tree)

        self.assertEqual(
            {"first": first, "second": second, "same_reference": first is second},
            {"first": expected, "second": expected, "same_reference": True},
        )

    def test_filters_non_ast_items_from_pattern_fields(self) -> None:
        """Responsibilities: _AST field child filtering_, _pattern child order_."""
        tree = ast.parse("match value:\n    case Point(x=field):\n        pass\n")
        match_statement = next(node for node in tree.body if type(node) is ast.Match)
        pattern = next(node for node in ast.walk(match_statement.cases[0].pattern) if type(node) is ast.MatchClass)
        expected = list(ast.iter_child_nodes(pattern))
        node_index = PythonAstNodeIndex()
        actual = node_index.children(pattern)

        self.assertEqual(
            {"actual": actual, "expected": expected, "keyword_names": pattern.kwd_attrs},
            {"actual": expected, "expected": expected, "keyword_names": ["x"]},
        )

    def test_children(self) -> None:
        """Responsibilities: _direct child cache_."""
        tree = ast.parse("def build():\n    value = 1\n    return value\n")
        function = tree.body[0]
        node_index = PythonAstNodeIndex()
        children = node_index.children(function)
        cached_children = node_index.children(function)
        self.assertEqual(
            {
                "children": children,
                "cached_children": cached_children,
                "same_reference": children is cached_children,
            },
            {
                "children": list(ast.iter_child_nodes(function)),
                "cached_children": list(ast.iter_child_nodes(function)),
                "same_reference": True,
            },
        )

    def test_ignores_ast_nodes_without_coding_rules(self) -> None:
        """Responsibilities: _unclassified AST node dispatch_."""
        python_ast_tree = PythonAstTree("value = 1\n")
        issues = python_ast_tree.coding_issues()
        self.assertEqual(issues, [])

    def test_detects_reversed_branch_comparisons(self) -> None:
        """Responsibilities: _reversed branch comparison detection_."""
        source = """if kind == "a":
    return "a"
else:
    if "b" == kind:
        return "b"
"""
        tree = ast.parse(source)
        python_ast_node_index = self._python_ast_node_index()
        structure_issues = StructureIssues(python_ast_node_index)
        issues = structure_issues.repeated_branches(tree)

        self.assertEqual(issues, [{"line": 0}])

    def test_collects_undefined_checks_from_indexed_source(self) -> None:
        """Responsibilities: _unnecessary undefined check diagnostics_."""
        tree = ast.parse(UNDEFINED_INDEX_SOURCE)
        comparisons = [node for node in ast.walk(tree) if type(node) is ast.Compare]

        aliases = PythonReferenceAliases(PythonReferenceAliasState())
        node_index = PythonAstNodeIndex()
        builder = UndefinedCheckState({}, {}, aliases, node_index)
        state = UndefinedCheckState(
            builder.bindings_for(tree),
            builder.fields_for(tree),
            aliases,
            node_index,
        )
        check = PythonUnnecessaryUndefinedCheck(tree, state)
        issues: list[JsonObject] = []
        for comparison in comparisons:
            issues.extend(check.collect_checks(comparison))

        self.assertEqual(
            issues,
            [
                {"line": 5, "kind": "unnecessary-undefined-check"},
                {"line": 8, "kind": "unnecessary-undefined-check"},
            ],
        )

    def test_reuses_source_line_split_for_source_segments(self) -> None:
        """Responsibilities: _source segments verification_."""
        unicode_value = chr(0x0451) + chr(0x0436)
        source = "def build():\n    value = (\n        '" + unicode_value + "'\n    )\n"
        parsed_source = ast.parse(source)
        source_function = self._function_node(parsed_source)
        node = source_function.body[0]
        segments = SourceSegments(source)

        self.assertEqual(
            {
                "function_node": type(source_function) is ast.FunctionDef,
                "segment": segments.segment(node),
            },
            {"function_node": True, "segment": ast.get_source_segment(source, node)},
        )

    def test_extracts_unicode_crlf_source_segments(self) -> None:
        """Responsibilities: _Unicode CRLF segment extraction_."""
        source = "def read():\r\n    return 'ё' + 'x'\r\n"
        parsed_source = ast.parse(source)
        function = next(node for node in parsed_source.body if type(node) is ast.FunctionDef)
        statement = function.body[0]
        segments = SourceSegments(source)
        expected = ast.get_source_segment(source, statement)

        first = segments.segment(statement)
        second = segments.segment(statement)

        self.assertEqual([first, second], [expected, expected])

    def test_preserves_form_feed_source_segments(self) -> None:
        """Responsibilities: _form-feed AST segment parity_."""
        source = "def read():\r\n    return 'ё' +\f 'x'\r\n"
        parsed_source = ast.parse(source)
        function = next(node for node in parsed_source.body if type(node) is ast.FunctionDef)
        statement = function.body[0]
        segments = SourceSegments(source)

        self.assertEqual(
            segments.segment(statement),
            ast.get_source_segment(source, statement),
        )

    def test_maps_utf8_byte_columns_to_unicode_character_columns(self) -> None:
        """Responsibilities: _UTF-8 byte-column conversion_."""
        unicode_value = chr(0x0451) + chr(0x0436)
        source = "value = '" + unicode_value + "'"
        segments = SourceSegments(source + "\n")

        first = segments.character_column(source, 9)
        second = segments.character_column(source, 11)

        self.assertEqual(
            [first, second],
            [9, 10],
        )

    def test_classifies_boolean_boundaries_without_rebuilding_operands(self) -> None:
        """Responsibilities: _Boolean boundary operand reuse_."""
        source = "flag == 0 or " + " or ".join(f"ready_{index}" for index in range(7))
        expression = ast.parse(source, mode="eval").body
        boundary = PythonExpressionBoundary(SourceSegments(source))

        result = boundary.ungrouped(expression)

        self.assertTrue(result)


class PythonComponentConstructionTest(unittest.TestCase):
    """Responsibilities: _AST metric collection_, _Python rule diagnostics_."""

    def test_function_selector_keeps_module_methods_and_nested_functions(self) -> None:
        """Responsibilities: _function declaration selection behavior_."""
        source = (
            "def module_function():\n"
            "    def nested_function():\n"
            "        return 1\n"
            "    return nested_function()\n"
            "class Service:\n"
            "    def method(self):\n"
            "        return 2\n"
        )
        tree = ast.parse(source)
        selector = PythonFunctionSelector(tree, PythonAstNodeIndex())

        self.assertEqual(
            [
                node.name
                for node in selector.nodes()
                if type(node) is ast.FunctionDef or type(node) is ast.AsyncFunctionDef
            ],
            ["module_function", "nested_function", "method"],
        )

    def test_collects_statement_metrics(self) -> None:
        """Responsibilities: _statement metrics verification_."""
        parsed_source = ast.parse(METRIC_SOURCE)
        node_index = PythonAstNodeIndex()
        function_selector = PythonFunctionSelector(parsed_source, node_index)
        function_nodes = function_selector.nodes()
        function_node = next(node for node in function_nodes if type(node) is ast.AsyncFunctionDef)
        function_body = function_node.body
        metrics = CallableMetrics(node_index)
        control_depth = metrics.control_flow_depth(function_body)
        self.assertEqual(
            (
                metrics.statements_sloc(function_body) > 10,
                metrics.statement_sloc(function_body[0]) > 1,
                control_depth,
            ),
            (True, True, 1),
        )

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
        mutations = PythonFieldMutationCollector()
        mutation_issues = [issue for node in ast.walk(tree) for issue in mutations.collect_mutations(node)]
        self.assertEqual(len(constructor_issues), 1)
        self.assertEqual({issue["kind"] for issue in mutation_issues}, {"object-field-write"})

    def test_collects_coding_issues(self) -> None:
        """Responsibilities: _coding diagnostics verification_."""
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
                "field_mutation": "object-field-write" in kinds,
            },
            {
                "broad": True,
                "multi": True,
                "dynamic": True,
                "results": True,
                "field_mutation": True,
            },
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
        python_ast_tree = PythonAstTree(source)
        broad_issues = [issue for issue in python_ast_tree.coding_issues() if issue["kind"] == "broad-except"]
        self.assertEqual(len(broad_issues), 2)

    def test_collects_base_exception(self) -> None:
        """Responsibilities: _base exception diagnostics verification_."""
        source = "try:\n    value = 1\nexcept BaseException:\n    value = 2\n"
        python_ast_tree = PythonAstTree(source)
        kinds = {issue["kind"] for issue in python_ast_tree.coding_issues()}
        self.assertIn("broad-except", kinds)
