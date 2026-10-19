from __future__ import annotations

import ast
from dataclasses import dataclass
from functools import cached_property

from implementation.protocols import PythonAstNodeIndexContract
from implementation.references.constants import PYTHON_ASSERT_RAISES_NAME
from implementation.references.aliases.protocols import (
    PythonContainerAliasesContract,
    PythonContainerKeysContract,
    PythonReferenceAliasesContract,
)


@dataclass(frozen=True)
class PythonTestAssertionAliasesOptions:
    """Responsibilities: _assertion alias inputs_, _exception assertion inputs_."""

    node: ast.AST
    node_index: PythonAstNodeIndexContract
    container_aliases: PythonContainerAliasesContract
    container_keys: PythonContainerKeysContract
    assignment_aliases: PythonReferenceAliasesContract


class PythonTestAssertionAliases:
    """Responsibilities: _assertion alias resolution_, _exception assertion resolution_."""

    def _getattr_reference(self, value: ast.AST, prefix: str) -> bool:
        """Responsibilities: _getattr assertion reference classification_."""
        if type(value) is not ast.Call:
            return False
        if type(value.func) is not ast.Name:
            return False
        if value.func.id != "getattr" or len(value.args) < 2:
            return False
        target = value.args[0]
        name = self.container_keys.static_key(value.args[1])
        if type(target) is not ast.Name:
            return False
        if target.id != "self":
            return False
        return name.startswith(prefix)

    def _attribute_reference(self, value: ast.Attribute, prefix: str) -> bool:
        """Responsibilities: _attribute assertion reference classification_."""
        receiver = value.value
        if type(receiver) is not ast.Name:
            return False
        if receiver.id != "self":
            return False
        return value.attr.startswith(prefix)

    def _is_assertion_reference(self, value: ast.AST, aliases: set[str]) -> bool:
        """Responsibilities: _assertion method reference classification_."""
        if type(value) is ast.Subscript:
            resolved = self.container_aliases.container_values.container_value(value)
            if not resolved.found():
                return False
            return self._is_assertion_reference(resolved.expression_node(), aliases)
        if type(value) is ast.Name:
            return value.id in aliases
        if self._getattr_reference(value, "assert"):
            return True
        if type(value) is not ast.Attribute:
            return False
        return self._attribute_reference(value, "assert")

    def _is_exception_reference(self, value: ast.AST, aliases: set[str]) -> bool:
        """Responsibilities: _exception method reference classification_."""
        if type(value) is ast.Subscript:
            resolved = self.container_aliases.container_values.container_value(value)
            if not resolved.found():
                return False
            return self._is_exception_reference(resolved.expression_node(), aliases)
        if type(value) is ast.Name:
            return value.id in aliases
        if self._getattr_reference(value, PYTHON_ASSERT_RAISES_NAME):
            return True
        if type(value) is not ast.Attribute:
            return False
        return self._attribute_reference(value, PYTHON_ASSERT_RAISES_NAME)

    def _assignment_targets(self, node: ast.AST) -> dict[str, ast.AST]:
        """Responsibilities: _assertion alias target collection_."""
        target_values: dict[str, ast.AST] = {}
        if type(node) is ast.Assign:
            for target in node.targets:
                target_values.update(
                    self.assignment_aliases.target_values(
                        target, node.value, references_only=False
                    )
                )
        if type(node) is ast.AnnAssign and node.value is not None:
            target_values = self.assignment_aliases.target_values(
                node.target, node.value, references_only=False
            )
        return target_values

    def _configure_aliases(self, node: ast.AST, aliases: set[str]) -> None:
        """Responsibilities: _assertion alias state configuration_."""
        for target, value in self._assignment_targets(node).items():
            if self._is_assertion_reference(value, aliases):
                aliases.add(target)
                continue
            aliases.discard(target)

    @cached_property
    def _assertion_aliases(self) -> set[str]:
        """Responsibilities: _assertion method alias state_."""
        aliases: set[str] = set()
        for node in self.node_index.nodes(self.node):
            self.container_aliases.observe(node)
            self._configure_aliases(node, aliases)
        return aliases

    def _configure_exception_aliases(self, node: ast.AST, aliases: set[str]) -> None:
        """Responsibilities: _exception alias state configuration_."""
        for target, value in self._assignment_targets(node).items():
            if self._is_exception_reference(value, aliases):
                aliases.add(target)
                continue
            aliases.discard(target)

    @cached_property
    def _exception_aliases(self) -> set[str]:
        """Responsibilities: _exception method alias state_."""
        aliases: set[str] = set()
        for node in self.node_index.nodes(self.node):
            self._configure_exception_aliases(node, aliases)
        return aliases

    def _exception_function_reference(self, function: ast.AST) -> bool:
        """Responsibilities: _exception assertion reference_."""
        if type(function) is ast.Name:
            return function.id in self._exception_aliases
        if type(function) is ast.Subscript:
            resolved = self.container_aliases.container_values.container_value(function)
            if not resolved.found():
                return False
            return self._is_exception_reference(
                resolved.expression_node(), self._exception_aliases
            )
        if type(function) is ast.Call:
            return self._is_exception_reference(function, self._exception_aliases)
        if type(function) is not ast.Attribute:
            return False
        return function.attr.startswith(PYTHON_ASSERT_RAISES_NAME)

    def __init__(self, options: PythonTestAssertionAliasesOptions) -> None:
        """Responsibilities: _initialization assertion alias state_."""
        self.node: ast.AST = options.node
        self.node_index: PythonAstNodeIndexContract = options.node_index
        self.assignment_aliases: PythonReferenceAliasesContract = (
            options.assignment_aliases
        )
        self.container_aliases: PythonContainerAliasesContract = (
            options.container_aliases
        )
        self.container_keys: PythonContainerKeysContract = options.container_keys

    def assertion_call(self, node: ast.Call) -> bool:
        """Responsibilities: _assertion reference classification_."""
        function: ast.AST = node.func
        if type(function) is ast.Subscript:
            resolved = self.container_aliases.container_values.container_value(function)
            if not resolved.found():
                return False
            function = resolved.expression_node()
        return self._is_assertion_reference(function, self._assertion_aliases)

    def exception_assertion(self, node: ast.Call) -> bool:
        """Responsibilities: _exception assertion classification_."""
        if not self.assertion_call(node):
            return False
        return self._exception_function_reference(node.func)

    def assertion_alias_present(self) -> bool:
        """Responsibilities: _assertion alias presence_."""
        aliases = self._assertion_aliases
        for item in self.node_index.nodes(self.node):
            if type(item) is not ast.Call:
                continue
            if type(item.func) is ast.Name and item.func.id in aliases:
                return True
            if type(item.func) is ast.Subscript:
                if self.assertion_call(item):
                    return True
        return False
