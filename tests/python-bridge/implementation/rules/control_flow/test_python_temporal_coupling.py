import ast
import unittest

from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.rules.control_flow.python_temporal_coupling import (
    PythonTemporalCoupling,
)


class PythonTemporalCouplingTest(unittest.TestCase):
    """Responsibilities: _temporal coupling regression cases_, _Python AST source parsing_."""

    def _tree(self, source: str) -> ast.Module:
        """Responsibilities: _temporal coupling source parsing_."""
        return ast.parse(source)

    def test_property_getter_and_setter_keep_distinct_callable_identity(self) -> None:
        """Responsibilities: _property setter dependency reporting_."""
        source = (
            "class Session:\n"
            "    @property\n"
            "    def socket(self):\n"
            "        return self._socket\n"
            "    @socket.setter\n"
            "    def socket(self, value):\n"
            "        self._socket = value\n"
        )

        tree = self._tree(source)
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)
        analysis = PythonTemporalCoupling(node_index)
        issues = analysis.issues(tree)

        self.assertEqual(issues, [{"kind": "temporal-coupling", "line": 5, "name": "_socket"}])

    def test_annotation_without_value_does_not_initialize_class_field(self) -> None:
        """Responsibilities: _class annotation dependency reporting_."""
        source = (
            "class Session:\n"
            "    socket: object\n"
            "    def connect(self):\n"
            "        self.socket = 'ready'\n"
            "    def send(self):\n"
            "        return self.socket\n"
        )

        tree = self._tree(source)
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)
        analysis = PythonTemporalCoupling(node_index)
        issues = analysis.issues(tree)

        self.assertEqual(issues, [{"kind": "temporal-coupling", "line": 2, "name": "socket"}])

    def test_annotation_without_value_does_not_initialize_constructor_field(self) -> None:
        """Responsibilities: _constructor annotation dependency reporting_."""
        source = (
            "class Session:\n"
            "    def __init__(self):\n"
            "        self.socket: object\n"
            "    def connect(self):\n"
            "        self.socket = 'ready'\n"
            "    def send(self):\n"
            "        return self.socket\n"
        )

        tree = self._tree(source)
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)
        analysis = PythonTemporalCoupling(node_index)
        issues = analysis.issues(tree)

        self.assertEqual(issues, [{"kind": "temporal-coupling", "line": 3, "name": "socket"}])

    def test_value_bearing_annotations_remain_initialization(self) -> None:
        """Responsibilities: _value-bearing annotation exemption_."""
        source = (
            "class Session:\n"
            "    socket: object = 'ready'\n"
            "    def connect(self):\n"
            "        self.socket = 'connected'\n"
            "    def send(self):\n"
            "        return self.socket\n"
        )

        tree = self._tree(source)
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)
        analysis = PythonTemporalCoupling(node_index)
        issues = analysis.issues(tree)

        self.assertEqual(issues, [])

    def test_temporal_coupling_reads_async_method_names(self) -> None:
        """Responsibilities: _async field dependency detection_."""
        source = (
            "class Worker:\n"
            "    def prepare(self):\n"
            "        self.state = 'ready'\n"
            "    async def run(self):\n"
            "        return self.state\n"
        )
        tree = self._tree(source)
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)
        coupling = PythonTemporalCoupling(node_index)
        issues = coupling.issues(tree)

        self.assertEqual(
            [{"kind": issue["kind"], "line": issue["line"], "name": issue["name"]} for issue in issues],
            [{"kind": "temporal-coupling", "line": 1, "name": "state"}],
        )

    def test_temporal_coupling_ignores_fields_after_receiver_reassignment(self) -> None:
        """Responsibilities: _receiver reassignment ownership_."""
        source = (
            "class Worker:\n"
            "    def prepare(self):\n"
            "        self = temporary\n"
            "        self.state = 'ready'\n"
            "    def run(self):\n"
            "        return self.state\n"
        )
        tree = self._tree(source)
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)
        coupling = PythonTemporalCoupling(node_index)

        self.assertEqual(coupling.issues(tree), [])
