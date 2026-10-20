import unittest

from implementation.ast.python_ast_tree import PythonAstTree
from tests.python.constants import (
    ANNOTATED_CLASS_ALIAS_SOURCE,
    LOCAL_CLASS_ALIAS_SOURCE,
    REPEATED_CALL_SOURCE,
)


class PythonCallRulesTest(unittest.TestCase):
    """Responsibilities: _alias rules_, _rule diagnostics_."""

    """Responsibilities: _Python alias rules_."""

    def test_annotated_class_init_alias(self) -> None:
        """Responsibilities: _annotated class initializer aliases_."""
        parser = PythonAstTree(ANNOTATED_CLASS_ALIAS_SOURCE)
        issues = parser.coding_issues()

        self.assertEqual(sum(issue["kind"] == "python-direct-class-init" for issue in issues), 1)

    def test_local_class_init_alias(self) -> None:
        """Responsibilities: _local class initializer aliases_."""
        parser = PythonAstTree(LOCAL_CLASS_ALIAS_SOURCE)
        issues = parser.coding_issues()

        self.assertEqual(sum(issue["kind"] == "python-direct-class-init" for issue in issues), 2)

    def test_nested_callable_container_resolution(self) -> None:
        """Responsibilities: _nested callable lookup diagnostics_."""
        source = """class Base:
    def __init__(self, value: str) -> None:
        self.value = value

class Token:
    def update(self, value: str) -> None:
        writers = {"state": {"field": object.__setattr__}}
        writers["state"]["field"](self, "value", value)

class Child(Base):
    def __init__(self, value: str) -> None:
        initializers = {"base": {"init": Base.__init__}}
        initializers["base"]["init"](self, value)
"""
        tree = PythonAstTree(source)
        issues = tree.coding_issues()

        self.assertEqual(
            {
                "object_setattr": sum(issue["kind"] == "python-object-setattr" for issue in issues),
                "direct_class_init": sum(issue["kind"] == "python-direct-class-init" for issue in issues),
            },
            {"object_setattr": 1, "direct_class_init": 1},
        )

    def test_reports_dynamic_assignment_through_super_setattr(self) -> None:
        """Responsibilities: _inherited reflective mutation detection_."""
        source = """class UserRecord:
    def update_field(self, field_name: str, value: str) -> None:
        super().__setattr__(field_name, value)
"""
        tree = PythonAstTree(source)
        issues = tree.coding_issues()

        self.assertIn("python-object-setattr", [issue["kind"] for issue in issues])

    def test_callable_probe_alias_controls_an_interface_branch(self) -> None:
        """Responsibilities: _callable capability analysis_."""
        source = """from collections.abc import Callable
from typing import Protocol

class ClientContract(Protocol):
    run: Callable[[], None] | None

def invoke_if_supported(client: ClientContract) -> None:
    supports_run = callable(client.run)
    if supports_run:
        client.run()

def invoke_after_reset(client: ClientContract) -> None:
    supports_run = callable(client.run)
    supports_run = False
    if supports_run:
        client.run()

def observe_capability(client: ClientContract) -> None:
    supports_run = callable(client.run)
    print(supports_run)
"""
        tree = PythonAstTree(source)
        issues = tree.coding_issues()

        self.assertEqual(
            sum(issue["kind"] == "callable-feature-detection" for issue in issues),
            1,
        )

    def test_repeated_analysis_preserves_call_issues(self) -> None:
        """Responsibilities: _issue stability_."""
        parser = PythonAstTree(REPEATED_CALL_SOURCE)
        first = parser.coding_issues()
        second = parser.coding_issues()

        self.assertEqual(second, first)
