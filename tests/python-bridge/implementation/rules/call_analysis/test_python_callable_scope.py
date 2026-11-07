import ast
import unittest

from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.rules.call_analysis.concrete_collaborator_creation import (
    ConcreteCollaboratorCreation,
)
from implementation.rules.call_analysis.python_implementation_downcast import PythonImplementationDowncast


class PythonCallableScopeTest(unittest.TestCase):
    """Responsibilities: _callable ownership tests_, _collaborator analysis tests_."""

    def test_rule_reports_concrete_collaborator_used_through_contract(self) -> None:
        """Responsibilities: _contract-backed collaborator diagnostic_."""
        source = (
            "from typing import Protocol\n"
            "class StoreContract(Protocol):\n"
            "    def load(self, key: str) -> str: ...\n"
            "class SqlStore(StoreContract):\n"
            "    def load(self, key: str) -> str: return key\n"
            "class Loader:\n"
            "    def load(self, key: str) -> str:\n"
            "        store: StoreContract = SqlStore()\n"
            "        return store.load(key)\n"
        )
        tree = ast.parse(source)
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)
        analysis = ConcreteCollaboratorCreation(tree, node_index)
        analysis.prepare()

        self.assertEqual(
            analysis.issues(),
            [{"line": 7, "kind": "concrete-collaborator-created-per-operation"}],
        )

    def test_nested_callable_calls_do_not_belong_to_enclosing_method(self) -> None:
        """Responsibilities: _nested callable isolation_."""
        source = """from typing import Protocol
class StoreContract(Protocol):
    def load(self, key: str) -> str: ...
class SqlStore(StoreContract):
    def load(self, key: str) -> str: return key
class Loader:
    def load(self, key: str) -> str:
        def nested() -> str:
            store: StoreContract = SqlStore()
            return store.load(key)
        return key
"""

        tree = ast.parse(source)
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)
        analysis = ConcreteCollaboratorCreation(tree, node_index)
        analysis.prepare()

        self.assertEqual(analysis.issues(), [])

    def test_nested_class_body_belongs_to_enclosing_method(self) -> None:
        """Responsibilities: _nested class execution scope_."""
        source = """from typing import Protocol
class StoreContract(Protocol):
    def load(self, key: str) -> str: ...
class SqlStore(StoreContract):
    def load(self, key: str) -> str: return key
class Loader:
    def load(self, key: str) -> str:
        class Nested:
            store: StoreContract = SqlStore()
            value = store.load(key)
        return key
"""

        tree = ast.parse(source)
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)
        analysis = ConcreteCollaboratorCreation(tree, node_index)
        analysis.prepare()

        self.assertEqual(
            analysis.issues(),
            [{"line": 8, "kind": "concrete-collaborator-created-per-operation"}],
        )

    def test_rule_analyzes_implementations_through_contracts(self) -> None:
        """Responsibilities: _contract implementation analysis_."""
        tree = ast.parse(
            """from typing import Protocol
class StorageContract(Protocol):
    def read(self) -> str: ...
class Store(StorageContract):
    def read(self) -> str: return "ready"
""",
        )
        node_index = PythonAstNodeIndex()
        analysis = ConcreteCollaboratorCreation(tree, node_index)
        analysis.prepare()
        issues = analysis.issues()

        self.assertEqual(issues, [])

    def test_repeated_contract_constructions_have_no_downcast_issue(self) -> None:
        """Responsibilities: _repeated contract construction analysis_."""
        tree = ast.parse(
            "from typing import Protocol\n"
            "class StoreContract(Protocol):\n"
            "    def read(self): ...\n"
            "class Store(StoreContract):\n"
            "    def read(self): return 'ready'\n"
            "class Service:\n"
            "    def run(self):\n"
            "        first = Store()\n"
            "        second = Store()\n"
            "        third = Store()\n"
            "        return first, second, third\n",
        )
        node_index = PythonAstNodeIndex()
        analysis = ConcreteCollaboratorCreation(tree, node_index)
        analysis.prepare()
        issues = analysis.issues()

        self.assertEqual(issues, [])

    def test_reuses_module_binding_for_repeated_guards(self) -> None:
        """Responsibilities: _module binding cache reuse_, _downcast results_."""
        tree = ast.parse(
            "from typing import Protocol\n"
            "class ReaderContract(Protocol):\n"
            "    def read(self): pass\n"
            "class Reader(ReaderContract):\n"
            "    def read(self): pass\n"
            "    def extra(self): pass\n"
            "def consume(value: ReaderContract):\n"
            "    if isinstance(value, Reader): value.extra()\n"
            "    if isinstance(value, Reader): value.extra()\n",
        )
        analysis = PythonImplementationDowncast(tree, PythonAstNodeIndex())
        analysis.prepare()
        calls = [node for node in ast.walk(tree) if type(node) is ast.Call and type(node.func) is ast.Name]
        issues = [analysis.issue(call) for call in calls]

        self.assertEqual(
            [issue["kind"] for issue in issues if issue],
            ["protocol-downcast-to-implementation"] * 2,
        )

    def test_reuses_module_binding_across_methods_in_one_module(self) -> None:
        """Responsibilities: _module binding reuse_."""
        tree = ast.parse(
            "from typing import Protocol\n"
            "class StoreContract(Protocol):\n"
            "    def read(self): ...\n"
            "class Store(StoreContract):\n"
            "    def read(self): return 'ready'\n"
            "class Service:\n"
            "    def first(self):\n"
            "        store: StoreContract = Store()\n"
            "        return store.read()\n"
            "    def second(self):\n"
            "        store: StoreContract = Store()\n"
            "        return store.read()\n",
        )
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)
        analysis = ConcreteCollaboratorCreation(tree, node_index)
        analysis.prepare()
        issues = analysis.issues()

        self.assertEqual(
            [issue["kind"] for issue in issues],
            ["concrete-collaborator-created-per-operation"] * 2,
        )
