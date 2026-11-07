import ast
import unittest

from implementation.ast.callables.callable_metrics import CallableMetrics
from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex


class PythonCallableMetricsTest(unittest.TestCase):
    """Responsibilities: _control-flow depth calculation_, _callable scope boundaries_."""

    def test_counts_nested_control_statements(self) -> None:
        """Responsibilities: _nested control depth_."""
        tree = ast.parse(
            "def run():\n"
            "    if ready:\n"
            "        for item in items:\n"
            "            while active:\n"
            "                pass\n",
        )
        function = tree.body[0]
        if type(function) is not ast.FunctionDef:
            self.fail("expected function declaration")
        metrics = CallableMetrics(PythonAstNodeIndex())

        self.assertEqual(metrics.control_flow_depth(function.body), 3)

    def test_ignores_nested_callable_body_when_counting_owner(self) -> None:
        """Responsibilities: _nested callable boundary_."""
        tree = ast.parse(
            "def run():\n"
            "    if ready:\n"
            "        def nested():\n"
            "            if other:\n"
            "                if deeper:\n"
            "                    pass\n",
        )
        function = tree.body[0]
        if type(function) is not ast.FunctionDef:
            self.fail("expected owner function")
        branch = function.body[0]
        if type(branch) is not ast.If:
            self.fail("expected control branch")
        nested = branch.body[0]
        if type(nested) is not ast.FunctionDef:
            self.fail("expected nested callable")
        metrics = CallableMetrics(PythonAstNodeIndex())

        self.assertEqual(
            (metrics.control_flow_depth(function.body), metrics.control_flow_depth(nested.body)),
            (1, 2),
        )
