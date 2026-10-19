import ast
import unittest
from unittest.mock import patch

from implementation.ast.callables.callable_arguments import CallableArguments
from implementation.ast.callables.callable_statements import CallableStatements
from implementation.ast.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.source_segments import SourceSegments
from implementation.python_default_parameter_issues import PythonDefaultParameterIssues
from implementation.references.aliases.python_container_aliases import PythonContainerAliases
from implementation.references.aliases.python_reference_aliases import PythonReferenceAliases
from implementation.references.python_proxy_receiver_aliases import PythonProxyReceiverAliases
from implementation.rules.call_analysis.python_proxy_callable_analyzer import PythonProxyCallableAnalyzer
from implementation.rules.call_analysis.python_proxy_target import PythonProxyTarget
from implementation.rules.control_flow.control_flow_issues import PythonControlFlowIssues, PythonControlFlowOptions
from implementation.rules.control_flow.python_predicate_condition import PythonPredicateCondition
from implementation.rules.control_flow.python_terminal_branch_rules import PythonTerminalBranchRules
from tests.python.constants import EDGE_SOURCE


class PythonBridgeCallRuleTest(unittest.TestCase):
    """Responsibilities: _invocation metadata_, _proxy boundaries_."""

    """Responsibilities: _Python AST outputs verification_."""

    def _python_ast_node_index(self) -> PythonAstNodeIndex:
        """Responsibilities: _AST index creation_."""
        return PythonAstNodeIndex()

    def test_callable_metadata(self) -> None:
        """Responsibilities: _callable metadata verification_."""
        parsed = ast.parse(
            "@classmethod\ndef build(self, value: Payload, /, limit: int = 1, *items: str, **options: object):\n    return value\n"
        )
        function = parsed.body[0]
        arguments = CallableArguments(self._python_ast_node_index())
        statements = CallableStatements()
        metadata = arguments.argument_metadata(function, arguments.callable_arguments(function), 12)
        function_statement = function.body[0]
        statement_shape = statements.statement_node(function_statement)
        self.assertEqual(
            {
                "argument_count": metadata["argument_count"],
                "decorators": metadata["decorators"],
                "statement": statement_shape["kind"],
            },
            {"argument_count": 5, "decorators": ["classmethod"], "statement": "return"},
        )

    def test_keyword_proxy_forwarding(self) -> None:
        """Responsibilities: _keyword proxy forwarding verification_."""
        source = "class Service:\n    def process_item(self, value: str) -> str:\n        return self._process_item(value=value)\n"
        tree = ast.parse(source)
        analyzer = PythonProxyCallableAnalyzer(tree, PythonProxyTarget(), PythonProxyReceiverAliases(tree))
        issues = [issue for node in ast.walk(tree) for issue in analyzer.analyze(node)]
        self.assertEqual([issue["kind"] for issue in issues], ["proxy-callable"])

    def test_proxy_receiver_reuses_parent_index(self) -> None:
        """Responsibilities: _proxy parent-index cache verification_."""
        tree = ast.parse("value = lambda item: self.handle(item)\n")
        aliases = PythonProxyReceiverAliases(tree)

        first = aliases.configure()
        second = aliases.configure()

        self.assertIs(first, second)

    def test_proxy_receiver_indexes_each_scope_once(self) -> None:
        """Responsibilities: _scope alias indexing_."""
        source = (
            "class Service:\n"
            "    def register(self):\n"
            "        first = lambda value: self.handle(value)\n"
            "        second = lambda value: self.handle(value)\n"
            "        third = lambda value: self.handle(value)\n"
        )
        tree = ast.parse(source)
        aliases = PythonProxyReceiverAliases(tree)
        lambdas = [node for node in ast.walk(tree) if type(node) is ast.Lambda]
        with patch(
            "implementation.references.python_proxy_receiver_aliases.ast.walk",
            wraps=ast.walk,
        ) as walk:
            results = [aliases.lambda_receiver(node) for node in lambdas]

        self.assertEqual({"results": results, "walks": walk.call_count}, {"results": [True, True, True], "walks": 2})

    def test_keyword_only_proxy_forwarding(self) -> None:
        """Responsibilities: _keyword-only proxy forwarding verification_."""
        source = "class Service:\n    def process_item(self, *, value: str) -> str:\n        return self._process_item(value=value)\n"
        tree = ast.parse(source)
        analyzer = PythonProxyCallableAnalyzer(tree, PythonProxyTarget(), PythonProxyReceiverAliases(tree))
        issues = [issue for node in ast.walk(tree) for issue in analyzer.analyze(node)]
        self.assertEqual([issue["kind"] for issue in issues], ["proxy-callable"])

    def test_variadic_proxy_forwarding(self) -> None:
        """Responsibilities: _variadic proxy forwarding verification_."""
        source = "class Service:\n    def process_items(self, *values: str) -> str:\n        return self._process_items(*values)\n"
        tree = ast.parse(source)
        analyzer = PythonProxyCallableAnalyzer(tree, PythonProxyTarget(), PythonProxyReceiverAliases(tree))
        issues = [issue for node in ast.walk(tree) for issue in analyzer.analyze(node)]
        self.assertEqual([issue["kind"] for issue in issues], ["proxy-callable"])

    def test_assignment_control_flow(self) -> None:
        """Responsibilities: _assignment diagnostics verification_."""
        control = PythonControlFlowIssues(
            PythonControlFlowOptions(
                ast.parse(EDGE_SOURCE),
                EDGE_SOURCE.splitlines(),
                set(),
                self._python_ast_node_index(),
                PythonPredicateCondition(),
                PythonTerminalBranchRules(),
                SourceSegments(EDGE_SOURCE),
            )
        )
        edge_tree = ast.parse(EDGE_SOURCE)
        default_parameters = PythonDefaultParameterIssues(edge_tree, self._python_ast_node_index())
        default_parameter_tree = ast.parse("def f(value=[], options={}): pass")
        default_parameter_function = default_parameter_tree.body[0]
        self.assertTrue(control.walrus_issues(ast.parse("(value := 1)", mode="eval").body))
        self.assertFalse(default_parameters.complex_default_issues(default_parameter_function))
