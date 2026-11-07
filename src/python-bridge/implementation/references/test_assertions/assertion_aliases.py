from __future__ import annotations

import ast
from collections.abc import Set as AbstractSet
from dataclasses import dataclass
from functools import cached_property

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.constants import PYTHON_ASSERT_RAISES_NAME
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonContainerKeysContract,
    PythonContainerValuesContract,
    PythonReferenceAliasesContract,
    PythonTestAssertionAliasOptionsContract,
)


@dataclass(frozen=True)
class PythonTestAssertionAliasNames:
    """Responsibilities: _assertion aliases_, _exception aliases_."""

    assertion_names: frozenset[str]
    exception_names: frozenset[str]


@dataclass(frozen=True)
class PythonTestAssertionAliasOptions:
    """Responsibilities: _assertion AST_, _alias resolution dependencies_."""

    node: ast.AST
    node_index: PythonAstNodeIndexContract
    container_aliases: PythonContainerAliasesContract
    container_keys: PythonContainerKeysContract
    container_values: PythonContainerValuesContract
    assignment_aliases: PythonReferenceAliasesContract


class PythonTestAssertionAliases:
    """Responsibilities: _assertion alias resolution_, _exception assertion resolution_."""

    _options: PythonTestAssertionAliasOptionsContract

    def _getattr_reference(self, getattr_expression: ast.AST, prefix: str) -> bool:
        """Responsibilities: _getattr assertion reference classification_."""
        if type(getattr_expression) is not ast.Call:
            return False
        if type(getattr_expression.func) is not ast.Name:
            return False
        if getattr_expression.func.id != "getattr" or len(getattr_expression.args) < 2:
            return False
        target = getattr_expression.args[0]
        name = self._options.container_keys.static_key(getattr_expression.args[1])
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

    def _is_assertion_reference(
        self,
        candidate: ast.AST,
        assertion_aliases: AbstractSet[str],
    ) -> bool:
        """Responsibilities: _assertion method reference classification_."""
        if type(candidate) is ast.Subscript:
            resolved = self._options.container_values.container_value(candidate)
            if not resolved.found():
                return False
            return self._is_assertion_reference(
                resolved.expression_node(),
                assertion_aliases,
            )
        if type(candidate) is ast.Name:
            return candidate.id in assertion_aliases
        if self._getattr_reference(candidate, "assert"):
            return True
        if type(candidate) is not ast.Attribute:
            return False
        return self._attribute_reference(candidate, "assert")

    def _is_exception_reference(
        self,
        candidate: ast.AST,
        exception_aliases: AbstractSet[str],
    ) -> bool:
        """Responsibilities: _exception method reference classification_."""
        if type(candidate) is ast.Subscript:
            resolved = self._options.container_values.container_value(candidate)
            if not resolved.found():
                return False
            return self._is_exception_reference(
                resolved.expression_node(),
                exception_aliases,
            )
        if type(candidate) is ast.Name:
            return candidate.id in exception_aliases
        if self._getattr_reference(candidate, PYTHON_ASSERT_RAISES_NAME):
            return True
        if type(candidate) is not ast.Attribute:
            return False
        return self._attribute_reference(candidate, PYTHON_ASSERT_RAISES_NAME)

    def _assignment_targets(self, assignment: ast.AST) -> dict[str, ast.AST]:
        """Responsibilities: _assignment alias targets_."""
        target_values: dict[str, ast.AST] = {}
        if type(assignment) is ast.Assign:
            for target in assignment.targets:
                target_values.update(
                    self._options.assignment_aliases.target_values(
                        target,
                        assignment.value,
                        references_only=False,
                    ),
                )
        if type(assignment) is ast.AnnAssign and assignment.value is not None:
            target_values = self._options.assignment_aliases.target_values(
                assignment.target,
                assignment.value,
                references_only=False,
            )
        return target_values

    def _configure_aliases(
        self,
        assignment: ast.AST,
        assertion_aliases: set[str],
        exception_aliases: set[str],
    ) -> None:
        """Responsibilities: _assertion alias state_."""
        for target, value in self._assignment_targets(assignment).items():
            if self._is_assertion_reference(value, assertion_aliases):
                assertion_aliases.add(target)
            else:
                assertion_aliases.discard(target)
            if self._is_exception_reference(value, exception_aliases):
                exception_aliases.add(target)
            else:
                exception_aliases.discard(target)

    @cached_property
    def _aliases(self) -> PythonTestAssertionAliasNames:
        """Responsibilities: _assertion alias cache_."""
        assertion_aliases: set[str] = set()
        exception_aliases: set[str] = set()
        container_aliases = self._options.container_aliases
        nodes = self._options.node_index.nodes(self._options.node)
        for node in nodes:
            node_type = type(node)
            if node_type in (ast.Import, ast.Assign, ast.AnnAssign):
                container_aliases.observe(node)
            if node_type in (ast.Assign, ast.AnnAssign):
                self._configure_aliases(node, assertion_aliases, exception_aliases)
        if nodes:
            container_aliases.state().select_scope_node(nodes[-1])
        return PythonTestAssertionAliasNames(
            frozenset(assertion_aliases),
            frozenset(exception_aliases),
        )

    def _exception_function_reference(self, function: ast.AST) -> bool:
        """Responsibilities: _exception assertion reference_."""
        aliases = self._aliases
        if type(function) is ast.Name:
            return function.id in aliases.exception_names
        if type(function) is ast.Subscript:
            resolved = self._options.container_values.container_value(function)
            if not resolved.found():
                return False
            return self._is_exception_reference(
                resolved.expression_node(),
                aliases.exception_names,
            )
        if type(function) is ast.Call:
            return self._is_exception_reference(function, aliases.exception_names)
        if type(function) is not ast.Attribute:
            return False
        return function.attr.startswith(PYTHON_ASSERT_RAISES_NAME)

    def __init__(self, options: PythonTestAssertionAliasOptionsContract) -> None:
        """Responsibilities: _initialization assertion alias state_."""
        self._options: PythonTestAssertionAliasOptionsContract = options

    def assertion_call(self, node: ast.Call) -> bool:
        """Responsibilities: _assertion reference classification_."""
        aliases = self._aliases
        function: ast.AST = node.func
        if type(function) is ast.Subscript:
            resolved = self._options.container_values.container_value(function)
            if not resolved.found():
                return False
            function = resolved.expression_node()
        return self._is_assertion_reference(function, aliases.assertion_names)

    def exception_assertion(self, node: ast.Call) -> bool:
        """Responsibilities: _exception assertion classification_."""
        if not self.assertion_call(node):
            return False
        return self._exception_function_reference(node.func)

    def assertion_alias_present(self) -> bool:
        """Responsibilities: _assertion alias presence_."""
        aliases = self._aliases.assertion_names
        for item in self._options.node_index.nodes(self._options.node):
            if type(item) is not ast.Call:
                continue
            if type(item.func) is ast.Name and item.func.id in aliases:
                return True
            if type(item.func) is ast.Subscript:
                if self.assertion_call(item):
                    return True
        return False
