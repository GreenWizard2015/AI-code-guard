from __future__ import annotations

import ast

from implementation.references.aliases.protocols import PythonContainerValuesContract
from implementation.rules.python_syntax.dynamic_import_call_target import (
    PythonDynamicImportCallTarget,
)
from implementation.rules.python_syntax.dynamic_import_subscript_owner import (
    PythonDynamicImportSubscriptOwner,
)
from implementation.rules.python_syntax.protocols import (
    PythonDynamicImportCallTargetContract,
    PythonDynamicImportReferenceContract,
    PythonDynamicImportSubscriptOwnerContract,
)
from implementation.rules.python_syntax.python_dynamic_import_reference import (
    PythonDynamicImportReference,
)
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


class PythonDynamicImportReferences:
    """Responsibilities: _dynamic import target resolution_, _static key extraction_."""

    def _name_reference(self, value: ast.Name) -> PythonDynamicImportReferenceContract:
        """Responsibilities: _named import reference_."""
        if value.id in self.module_aliases:
            return PythonDynamicImportReference(
                PYTHON_MODULE_KIND, self.module_aliases[value.id]
            )
        if value.id in self.builtin_module_aliases:
            return PythonDynamicImportReference(
                PYTHON_MODULE_KIND, PYTHON_BUILTINS_MODULE
            )
        if value.id in self.function_aliases:
            return PythonDynamicImportReference(
                PYTHON_FUNCTION_KIND, self.function_aliases[value.id]
            )
        return PythonDynamicImportReference("", "")

    def _attribute_reference(
        self, value: ast.Attribute, seen: set[int]
    ) -> PythonDynamicImportReferenceContract:
        """Responsibilities: _qualified import reference_."""
        resolved = self.container_values.attribute_value(value)
        if resolved.found():
            return self.reference(resolved.expression_node(), seen)
        if type(value.value) is not ast.Name:
            return PythonDynamicImportReference("", "")
        target = value.value.id
        return self._named_attribute_reference(target, value.attr)

    def _named_attribute_reference(
        self, target: str, name: str
    ) -> PythonDynamicImportReferenceContract:
        """Responsibilities: _dynamic import attributes_."""
        if self.module_aliases.get(target) == PYTHON_IMPORTLIB_MODULE:
            if name == PYTHON_IMPORT_MODULE_FUNCTION:
                return PythonDynamicImportReference(
                    PYTHON_FUNCTION_KIND, PYTHON_IMPORT_MODULE_FUNCTION
                )
        if target in self.builtin_module_aliases:
            if name == PYTHON_DYNAMIC_IMPORT_FUNCTION:
                return PythonDynamicImportReference(
                    PYTHON_FUNCTION_KIND, PYTHON_DYNAMIC_IMPORT_FUNCTION
                )
        return PythonDynamicImportReference("", "")

    def _subscript_reference(
        self, value: ast.Subscript
    ) -> PythonDynamicImportReferenceContract:
        """Responsibilities: _builtin mapping reference_."""
        owner = self._subscript_owner(value)
        if owner.module == "":
            return PythonDynamicImportReference("", "")
        module = owner.module
        name = owner.name
        if self.module_aliases.get(module) == PYTHON_IMPORTLIB_MODULE:
            if name == PYTHON_IMPORT_MODULE_FUNCTION:
                return PythonDynamicImportReference(
                    PYTHON_FUNCTION_KIND, PYTHON_IMPORT_MODULE_FUNCTION
                )
        if module not in self.builtin_module_aliases:
            return PythonDynamicImportReference("", "")
        if name in {PYTHON_GETATTR_FUNCTION, PYTHON_DYNAMIC_IMPORT_FUNCTION}:
            return PythonDynamicImportReference(PYTHON_FUNCTION_KIND, name)
        return PythonDynamicImportReference("", "")

    def _subscript_owner(
        self, value: ast.Subscript
    ) -> PythonDynamicImportSubscriptOwnerContract:
        """Responsibilities: _builtin mapping owner_."""
        owner = value.value
        if type(owner) is not ast.Attribute:
            return PythonDynamicImportSubscriptOwner("", "")
        if owner.attr != PYTHON_DICT_ATTRIBUTE:
            return PythonDynamicImportSubscriptOwner("", "")
        if type(owner.value) is not ast.Name:
            return PythonDynamicImportSubscriptOwner("", "")
        return PythonDynamicImportSubscriptOwner(
            owner.value.id, self.static_key(value.slice)
        )

    def _call_reference(
        self, value: ast.Call, seen: set[int]
    ) -> PythonDynamicImportReferenceContract:
        """Responsibilities: _reflected callable reference_."""
        target_name = self._call_target(value, seen)
        target = target_name.reference
        name = target_name.name
        if target.kind_value() == PYTHON_MODULE_KIND:
            if target.name_value() == PYTHON_IMPORTLIB_MODULE:
                if name == PYTHON_IMPORT_MODULE_FUNCTION:
                    return PythonDynamicImportReference(
                        PYTHON_FUNCTION_KIND, PYTHON_IMPORT_MODULE_FUNCTION
                    )
            if target.name_value() == PYTHON_BUILTINS_MODULE:
                if name == PYTHON_DYNAMIC_IMPORT_FUNCTION:
                    return PythonDynamicImportReference(
                        PYTHON_FUNCTION_KIND, PYTHON_DYNAMIC_IMPORT_FUNCTION
                    )
        return PythonDynamicImportReference("", "")

    def _call_target(
        self, value: ast.Call, seen: set[int]
    ) -> PythonDynamicImportCallTargetContract:
        """Responsibilities: _reflected callable target_."""
        function = self.reference(value.func, seen)
        if function.kind_value() != PYTHON_FUNCTION_KIND:
            return PythonDynamicImportCallTarget(
                PythonDynamicImportReference("", ""), ""
            )
        if function.name_value() != PYTHON_GETATTR_FUNCTION:
            return PythonDynamicImportCallTarget(
                PythonDynamicImportReference("", ""), ""
            )
        if len(value.args) < 2:
            return PythonDynamicImportCallTarget(
                PythonDynamicImportReference("", ""), ""
            )
        return PythonDynamicImportCallTarget(
            self.reference(value.args[0], seen),
            self.static_key(value.args[1]),
        )

    def _subscript_expression_reference(
        self, value: ast.Subscript, seen: set[int]
    ) -> PythonDynamicImportReferenceContract:
        """Responsibilities: _subscript expression reference_."""
        direct = self._subscript_reference(value)
        if direct.resolved():
            return direct
        resolved = self.container_values.container_value(value)
        if not resolved.found():
            return PythonDynamicImportReference("", "")
        return self.reference(resolved.expression_node(), seen)

    def __init__(
        self,
        module_aliases: dict[str, str],
        builtin_module_aliases: set[str],
        function_aliases: dict[str, str],
        container_values: PythonContainerValuesContract,
    ) -> None:
        """Responsibilities: _initialization dynamic import references_."""
        self.module_aliases: dict[str, str] = module_aliases
        self.builtin_module_aliases: set[str] = builtin_module_aliases
        self.function_aliases: dict[str, str] = function_aliases
        self.container_values: PythonContainerValuesContract = container_values

    def static_key(self, value: ast.AST) -> str:
        """Responsibilities: _static reflection key_."""
        if type(value) is not ast.Constant:
            return ""
        if type(value.value) is not str:
            return ""
        return value.value

    def reference(
        self, value: ast.AST, seen: set[int]
    ) -> PythonDynamicImportReferenceContract:
        """Responsibilities: _dynamic import expression reference_."""
        if id(value) in seen:
            return PythonDynamicImportReference("", "")
        seen.add(id(value))
        if type(value) is ast.Name:
            return self._name_reference(value)
        if type(value) is ast.Attribute:
            return self._attribute_reference(value, seen)
        if type(value) is ast.Call:
            return self._call_reference(value, seen)
        if type(value) is ast.Subscript:
            return self._subscript_expression_reference(value, seen)
        return PythonDynamicImportReference("", "")
