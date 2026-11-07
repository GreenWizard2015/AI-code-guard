import ast
import unittest

from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.rules.coding_issues.python_runtime_patching import (
    PythonRuntimePatching,
)


class PythonRuntimePatchingTest(unittest.TestCase):
    """Responsibilities: _replacement findings_, _dependency implementation allowance_."""

    def test_detects_aliased_patch_and_direct_function_replacement(self) -> None:
        """Responsibilities: _patch API detection_."""
        tree = ast.parse(
            "from unittest.mock import patch as replace\n"
            "def fake_send() -> str:\n"
            "    return 'patched'\n"
            "with replace('gateway.send'):\n"
            "    run()\n"
            "gateway.send = fake_send\n",
        )
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)
        patching = PythonRuntimePatching(tree, node_index)
        issues = patching.issues()

        self.assertEqual(
            [(issue["kind"], issue["line"]) for issue in issues],
            [("runtime-patching", 3), ("runtime-patching", 5)],
        )

    def test_allows_injected_protocol_implementation(self) -> None:
        """Responsibilities: _dependency implementation injection_."""
        tree = ast.parse(
            "from typing import Protocol\n"
            "class GatewayContract(Protocol):\n"
            "    def send(self) -> str: ...\n"
            "class MemoryGateway:\n"
            "    def send(self) -> str:\n"
            "        return 'ok'\n"
            "class Service:\n"
            "    def __init__(self, gateway: GatewayContract) -> None:\n"
            "        self._gateway = gateway\n"
            "Service(MemoryGateway())\n",
        )
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)

        patching = PythonRuntimePatching(tree, node_index)
        issues = patching.issues()
        self.assertEqual(issues, [])

    def test_detects_pytest_patch_fixture(self) -> None:
        """Responsibilities: _patch fixture detection_."""
        tree = ast.parse("def test_send(monkeypatch) -> None:\n    monkeypatch.setattr(gateway, 'send', fake_send)\n")
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)
        patching = PythonRuntimePatching(tree, node_index)
        issues = patching.issues()

        self.assertEqual([issue["kind"] for issue in issues], ["runtime-patching"])

    def test_detects_pytest_mock_patch_fixture(self) -> None:
        """Responsibilities: _pytest mock fixture detection_."""
        tree = ast.parse("def test_send(mocker) -> None:\n    mocker.patch.object(gateway, 'send')\n")
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)
        patching = PythonRuntimePatching(tree, node_index)
        issues = patching.issues()

        self.assertEqual([issue["kind"] for issue in issues], ["runtime-patching"])

    def test_detects_data_replacement_through_patch_fixture(self) -> None:
        """Responsibilities: _patched data detection_."""
        tree = ast.parse("def test_status(mocker) -> None:\n    mocker.patch.object(gateway, 'status', 'fake')\n")
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)

        patching = PythonRuntimePatching(tree, node_index)
        issues = patching.issues()
        self.assertEqual([issue["kind"] for issue in issues], ["runtime-patching"])

    def test_detects_patch_fixture_alias(self) -> None:
        """Responsibilities: _patch API alias detection_."""
        tree = ast.parse(
            """\
def test_send(monkeypatch) -> None:
    update = monkeypatch.setattr
    update(gateway, 'send', fake_send)
""",
        )
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)
        patching = PythonRuntimePatching(tree, node_index)
        issues = patching.issues()

        self.assertEqual([issue["kind"] for issue in issues], ["runtime-patching"])

    def test_allows_ordinary_data_assignment(self) -> None:
        """Responsibilities: _ordinary object field assignment_."""
        tree = ast.parse("gateway.status = 'ready'\n")
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)

        patching = PythonRuntimePatching(tree, node_index)
        issues = patching.issues()
        self.assertEqual(issues, [])

    def test_detects_data_replacement_through_setattr(self) -> None:
        """Responsibilities: _dynamic data replacement detection_."""
        tree = ast.parse("setattr(gateway, 'status', 'fake')\n")
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)

        patching = PythonRuntimePatching(tree, node_index)
        issues = patching.issues()
        self.assertEqual([issue["kind"] for issue in issues], ["runtime-patching"])

    def test_allows_initializing_an_instance_callback_field(self) -> None:
        """Responsibilities: _constructor callback field initialization_."""
        tree = ast.parse(
            """\
class Service:
    def __init__(self) -> None:
        self.callback = lambda: 'ready'
""",
        )
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)

        patching = PythonRuntimePatching(tree, node_index)
        issues = patching.issues()
        self.assertEqual(issues, [])
