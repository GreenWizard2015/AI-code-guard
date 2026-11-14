import ast
import unittest

from implementation.ast.callable_nodes.python_function_selector import (
    PythonFunctionSelector,
)
from implementation.ast.callables.callable_metrics import CallableMetrics
from implementation.ast.callables.callable_statements import CallableStatements
from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.python_ast_tree import PythonAstTree
from implementation.rules.coding_issues.constructor_rules import ConstructorRules
from implementation.rules.coding_issues.states.python_field_mutation_collector import (
    PythonFieldMutationCollector,
)

from tests.python.constants import (
    CONSTRUCTOR_SOURCE,
    METRIC_SOURCE,
)


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
