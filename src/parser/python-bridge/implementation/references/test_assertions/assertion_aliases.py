from __future__ import annotations

import ast
from functools import cached_property
from typing import Any

from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.references.aliases.container_aliases import PythonContainerAliases
from implementation.references.aliases.container_keys import PythonContainerKeys
from implementation.references.aliases.protocols import PythonContainerAliasesProtocol
from implementation.references.aliases.reference_aliases import PythonReferenceAliases


class PythonTestAssertionAliases:
    """Responsibilities: _test assertion aliases_."""

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
        if type(value) is ast.Name:
            return value.id in aliases
        if self._getattr_reference(value, "assert"):
            return True
        if type(value) is not ast.Attribute:
            return False
        return self._attribute_reference(value, "assert")

    def _is_exception_reference(self, value: ast.AST, aliases: set[str]) -> bool:
        """Responsibilities: _exception method reference classification_."""
        if type(value) is ast.Name:
            return value.id in aliases
        if self._getattr_reference(value, "assertRaises"):
            return True
        if type(value) is not ast.Attribute:
            return False
        return self._attribute_reference(value, "assertRaises")

    def _assignment_targets(self, node: ast.AST) -> dict[str, ast.AST]:
        """Responsibilities: _assertion alias target collection_."""
        target_values: dict[str, ast.AST] = {}
        if type(node) is ast.Assign:
            for target in node.targets:
                target_values.update(
                    self.assignment_aliases.target_values(target, node.value)
                )
        if type(node) is ast.AnnAssign and node.value is not None:
            target_values = self.assignment_aliases.target_values(
                node.target, node.value
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

    def __init__(self, node: ast.AST, node_index: PythonAstNodeIndexProtocol) -> None:
        """Responsibilities: _initialization assertion alias state_."""
        self.node: Any = node
        self.node_index: PythonAstNodeIndexProtocol = node_index
        self.assignment_aliases: PythonReferenceAliases = PythonReferenceAliases()
        self.container_aliases: PythonContainerAliasesProtocol = (
            PythonContainerAliases()
        )
        self.container_keys: PythonContainerKeys = PythonContainerKeys(
            self.container_aliases
        )

    def assertion_call(self, node: ast.Call) -> bool:
        """Responsibilities: _assertion reference classification_."""
        function: Any = node.func
        if type(function) is ast.Subscript:
            resolved = self.container_aliases.values.container_value(function)
            if not resolved.found():
                return False
            function = resolved.expression_node()
        return self._is_assertion_reference(function, self._assertion_aliases)

    def exception_assertion(self, node: ast.Call) -> bool:
        """Responsibilities: _exception assertion classification_."""
        if not self.assertion_call(node):
            return False
        function: Any = node.func
        if type(function) is ast.Name:
            return function.id in self._exception_aliases
        if type(function) is ast.Subscript:
            resolved = self.container_aliases.values.container_value(function)
            if not resolved.found():
                return False
            return self._is_exception_reference(
                resolved.expression_node(), self._exception_aliases
            )
        if type(function) is ast.Call:
            return self._is_exception_reference(function, self._exception_aliases)
        return function.attr.startswith("assertRaises")

    @cached_property
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
