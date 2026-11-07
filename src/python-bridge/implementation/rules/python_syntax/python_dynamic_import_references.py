from __future__ import annotations

import ast
from dataclasses import dataclass

from implementation.references.protocols import PythonContainerValuesContract
from implementation.rules.constants import (
    PYTHON_BUILTINS_MODULE,
    PYTHON_DICT_ATTRIBUTE,
    PYTHON_DYNAMIC_IMPORT_FUNCTION,
    PYTHON_FUNCTION_KIND,
    PYTHON_GETATTR_FUNCTION,
    PYTHON_IMPORT_MODULE_FUNCTION,
    PYTHON_IMPORTLIB_MODULE,
    PYTHON_MODULE_KIND,
)
from implementation.rules.python_syntax.protocols import (
    PythonDynamicImportCallTargetContract,
    PythonDynamicImportReferenceContract,
    PythonDynamicImportSubscriptOwnerContract,
)
from implementation.rules.python_syntax.python_dynamic_import_reference import (
    PythonDynamicImportReference,
)


@dataclass(frozen=True)
class PythonDynamicImportSubscriptOwner:
    """Responsibilities: _dynamic import subscript owner_."""

    module: str
    name: str


@dataclass(frozen=True)
class PythonDynamicImportCallTarget:
    """Responsibilities: _dynamic import target_."""

    reference: PythonDynamicImportReferenceContract
    name: str


class PythonDynamicImportReferences:
    """Responsibilities: _dynamic import target resolution_, _static key extraction_."""

    _seen_expressions: set[int]

    def _name_reference(self, value: ast.Name) -> PythonDynamicImportReferenceContract:
        """Responsibilities: _named import reference_."""
        if value.id in self._module_aliases:
            return PythonDynamicImportReference(
                PYTHON_MODULE_KIND,
                self._module_aliases[value.id],
            )
        if value.id in self._builtin_module_aliases:
            return PythonDynamicImportReference(
                PYTHON_MODULE_KIND,
                PYTHON_BUILTINS_MODULE,
            )
        if value.id in self._function_aliases:
            return PythonDynamicImportReference(
                PYTHON_FUNCTION_KIND,
                self._function_aliases[value.id],
            )
        return PythonDynamicImportReference("", "")

    def _attribute_reference(
        self,
        attribute_expression: ast.Attribute,
    ) -> PythonDynamicImportReferenceContract:
        """Responsibilities: _qualified import reference_."""
        resolved = self._container_values.attribute_value(attribute_expression)
        if resolved.found():
            return self._resolve_reference(resolved.expression_node())
        if type(attribute_expression.value) is not ast.Name:
            return PythonDynamicImportReference("", "")
        target = attribute_expression.value.id
        return self._named_attribute_reference(target, attribute_expression.attr)

    def _named_attribute_reference(
        self,
        target: str,
        name: str,
    ) -> PythonDynamicImportReferenceContract:
        """Responsibilities: _dynamic import attributes_."""
        if self._module_aliases.get(target) == PYTHON_IMPORTLIB_MODULE:
            if name == PYTHON_IMPORT_MODULE_FUNCTION:
                return PythonDynamicImportReference(
                    PYTHON_FUNCTION_KIND,
                    PYTHON_IMPORT_MODULE_FUNCTION,
                )
        if target in self._builtin_module_aliases:
            if name == PYTHON_DYNAMIC_IMPORT_FUNCTION:
                return PythonDynamicImportReference(
                    PYTHON_FUNCTION_KIND,
                    PYTHON_DYNAMIC_IMPORT_FUNCTION,
                )
        return PythonDynamicImportReference("", "")

    def _subscript_reference(
        self,
        mapping_expression: ast.Subscript,
    ) -> PythonDynamicImportReferenceContract:
        """Responsibilities: _builtin mapping reference_."""
        owner = self._subscript_owner(mapping_expression)
        if not owner.module:
            return PythonDynamicImportReference("", "")
        module = owner.module
        name = owner.name
        if self._module_aliases.get(module) == PYTHON_IMPORTLIB_MODULE:
            if name == PYTHON_IMPORT_MODULE_FUNCTION:
                return PythonDynamicImportReference(
                    PYTHON_FUNCTION_KIND,
                    PYTHON_IMPORT_MODULE_FUNCTION,
                )
        if module not in self._builtin_module_aliases:
            return PythonDynamicImportReference("", "")
        if name in {PYTHON_GETATTR_FUNCTION, PYTHON_DYNAMIC_IMPORT_FUNCTION}:
            return PythonDynamicImportReference(PYTHON_FUNCTION_KIND, name)
        return PythonDynamicImportReference("", "")

    def _subscript_owner(
        self,
        owner_expression: ast.Subscript,
    ) -> PythonDynamicImportSubscriptOwnerContract:
        """Responsibilities: _builtin mapping owner_."""
        owner = owner_expression.value
        if type(owner) is not ast.Attribute:
            return PythonDynamicImportSubscriptOwner("", "")
        if owner.attr != PYTHON_DICT_ATTRIBUTE:
            return PythonDynamicImportSubscriptOwner("", "")
        if type(owner.value) is not ast.Name:
            return PythonDynamicImportSubscriptOwner("", "")
        return PythonDynamicImportSubscriptOwner(
            owner.value.id,
            self.static_key(owner_expression.slice),
        )

    def _call_reference(
        self,
        dynamic_call: ast.Call,
    ) -> PythonDynamicImportReferenceContract:
        """Responsibilities: _reflected callable reference_."""
        target_name = self._call_target(dynamic_call)
        target = target_name.reference
        name = target_name.name
        if target.kind_value() == PYTHON_MODULE_KIND:
            if target.name_value() == PYTHON_IMPORTLIB_MODULE:
                if name == PYTHON_IMPORT_MODULE_FUNCTION:
                    return PythonDynamicImportReference(
                        PYTHON_FUNCTION_KIND,
                        PYTHON_IMPORT_MODULE_FUNCTION,
                    )
            if target.name_value() == PYTHON_BUILTINS_MODULE:
                if name == PYTHON_DYNAMIC_IMPORT_FUNCTION:
                    return PythonDynamicImportReference(
                        PYTHON_FUNCTION_KIND,
                        PYTHON_DYNAMIC_IMPORT_FUNCTION,
                    )
        return PythonDynamicImportReference("", "")

    def _call_target(
        self,
        target_call: ast.Call,
    ) -> PythonDynamicImportCallTargetContract:
        """Responsibilities: _reflected callable target_."""
        function = self._resolve_reference(target_call.func)
        if function.kind_value() != PYTHON_FUNCTION_KIND:
            return PythonDynamicImportCallTarget(
                PythonDynamicImportReference("", ""),
                "",
            )
        if function.name_value() != PYTHON_GETATTR_FUNCTION:
            return PythonDynamicImportCallTarget(
                PythonDynamicImportReference("", ""),
                "",
            )
        if len(target_call.args) < 2:
            return PythonDynamicImportCallTarget(
                PythonDynamicImportReference("", ""),
                "",
            )
        return PythonDynamicImportCallTarget(
            self._resolve_reference(target_call.args[0]),
            self.static_key(target_call.args[1]),
        )

    def _subscript_expression_reference(
        self,
        subscript_expression: ast.Subscript,
    ) -> PythonDynamicImportReferenceContract:
        """Responsibilities: _subscript expression reference_."""
        direct = self._subscript_reference(subscript_expression)
        if direct.resolved():
            return direct
        resolved = self._container_values.container_value(subscript_expression)
        if not resolved.found():
            return PythonDynamicImportReference("", "")
        return self._resolve_reference(resolved.expression_node())

    def _resolve_reference(
        self,
        expression: ast.AST,
    ) -> PythonDynamicImportReferenceContract:
        """Responsibilities: _dynamic import expression reference_."""
        if id(expression) in self._seen_expressions:
            return PythonDynamicImportReference("", "")
        self._seen_expressions.add(id(expression))
        try:
            if type(expression) is ast.Name:
                return self._name_reference(expression)
            if type(expression) is ast.Attribute:
                return self._attribute_reference(expression)
            if type(expression) is ast.Call:
                return self._call_reference(expression)
            if type(expression) is ast.Subscript:
                return self._subscript_expression_reference(expression)
            return PythonDynamicImportReference("", "")
        finally:
            self._seen_expressions.remove(id(expression))

    def __init__(
        self,
        module_aliases: dict[str, str],
        builtin_module_aliases: set[str],
        function_aliases: dict[str, str],
        container_values: PythonContainerValuesContract,
    ) -> None:
        """Responsibilities: _initialization dynamic import references_."""
        self._module_aliases: dict[str, str] = module_aliases
        self._builtin_module_aliases: set[str] = builtin_module_aliases
        self._function_aliases: dict[str, str] = function_aliases
        self._container_values: PythonContainerValuesContract = container_values
        self._seen_expressions = set()

    def static_key(self, value: ast.AST) -> str:
        """Responsibilities: _static reflection key_."""
        if type(value) is not ast.Constant:
            return ""
        if type(value.value) is not str:
            return ""
        return value.value

    def reference(self, expression: ast.AST) -> PythonDynamicImportReferenceContract:
        """Responsibilities: _top-level dynamic import reference_."""
        self._seen_expressions.clear()
        return self._resolve_reference(expression)
