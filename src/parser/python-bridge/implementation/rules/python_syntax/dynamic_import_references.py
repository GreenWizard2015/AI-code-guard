from __future__ import annotations

import ast

from implementation.references.aliases.protocols import PythonContainerValuesProtocol
from implementation.rules.python_syntax.dynamic_import_call_target import (
    PythonDynamicImportCallTarget,
)
from implementation.rules.python_syntax.dynamic_import_reference import (
    PythonDynamicImportReference,
)
from implementation.rules.python_syntax.protocols import (
    PythonDynamicImportReferenceProtocol,
)
from implementation.rules.python_syntax.dynamic_import_subscript_owner import (
    PythonDynamicImportSubscriptOwner,
)


class PythonDynamicImportReferences:
    """Responsibilities: _dynamic import expression resolution_."""

    def _name_reference(self, value: ast.Name) -> PythonDynamicImportReferenceProtocol:
        """Responsibilities: _named import reference_."""
        if value.id in self.module_aliases:
            return PythonDynamicImportReference("module", self.module_aliases[value.id])
        if value.id in self.builtin_module_aliases:
            return PythonDynamicImportReference("module", "builtins")
        if value.id in self.function_aliases:
            return PythonDynamicImportReference(
                "function", self.function_aliases[value.id]
            )
        return PythonDynamicImportReference("", "")

    def _attribute_reference(
        self, value: ast.Attribute, seen: set[int]
    ) -> PythonDynamicImportReferenceProtocol:
        """Responsibilities: _qualified import reference_."""
        resolved = self.container_values.attribute_value(value)
        if resolved.found():
            return self.reference(resolved.expression_node(), seen)
        if type(value.value) is not ast.Name:
            return PythonDynamicImportReference("", "")
        target = value.value.id
        if self.module_aliases.get(target) == "importlib":
            if value.attr == "import_module":
                return PythonDynamicImportReference("function", "import_module")
        if target in self.builtin_module_aliases:
            if value.attr == "__import__":
                return PythonDynamicImportReference("function", "__import__")
        return PythonDynamicImportReference("", "")

    def _subscript_reference(
        self, value: ast.Subscript
    ) -> PythonDynamicImportReferenceProtocol:
        """Responsibilities: _builtin mapping reference_."""
        owner = self._subscript_owner(value)
        if owner.module == "":
            return PythonDynamicImportReference("", "")
        module = owner.module
        name = owner.name
        if self.module_aliases.get(module) == "importlib":
            if name == "import_module":
                return PythonDynamicImportReference("function", "import_module")
        if module not in self.builtin_module_aliases:
            return PythonDynamicImportReference("", "")
        if name in {"getattr", "__import__"}:
            return PythonDynamicImportReference("function", name)
        return PythonDynamicImportReference("", "")

    def _subscript_owner(
        self, value: ast.Subscript
    ) -> PythonDynamicImportSubscriptOwner:
        """Responsibilities: _builtin mapping owner_."""
        owner = value.value
        if type(owner) is not ast.Attribute:
            return PythonDynamicImportSubscriptOwner("", "")
        if owner.attr != "__dict__":
            return PythonDynamicImportSubscriptOwner("", "")
        if type(owner.value) is not ast.Name:
            return PythonDynamicImportSubscriptOwner("", "")
        return PythonDynamicImportSubscriptOwner(
            owner.value.id, self.static_key(value.slice)
        )

    def _call_reference(
        self, value: ast.Call, seen: set[int]
    ) -> PythonDynamicImportReferenceProtocol:
        """Responsibilities: _reflected callable reference_."""
        target_name = self._call_target(value, seen)
        target = target_name.reference
        name = target_name.name
        if target.kind_value() == "module":
            if target.name_value() == "importlib":
                if name == "import_module":
                    return PythonDynamicImportReference("function", "import_module")
            if target.name_value() == "builtins":
                if name == "__import__":
                    return PythonDynamicImportReference("function", "__import__")
        return PythonDynamicImportReference("", "")

    def _call_target(
        self, value: ast.Call, seen: set[int]
    ) -> PythonDynamicImportCallTarget:
        """Responsibilities: _reflected callable target_."""
        function = self.reference(value.func, seen)
        if function.kind_value() != "function":
            return PythonDynamicImportCallTarget(
                PythonDynamicImportReference("", ""), ""
            )
        if function.name_value() != "getattr":
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
    ) -> PythonDynamicImportReferenceProtocol:
        """Responsibilities: _subscript expression reference_."""
        direct = self._subscript_reference(value)
        if direct.available():
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
        container_values: PythonContainerValuesProtocol,
    ) -> None:
        """Responsibilities: _initialization dynamic import references_."""
        self.module_aliases: dict[str, str] = module_aliases
        self.builtin_module_aliases: set[str] = builtin_module_aliases
        self.function_aliases: dict[str, str] = function_aliases
        self.container_values: PythonContainerValuesProtocol = container_values

    def static_key(self, value: ast.AST) -> str:
        """Responsibilities: _static reflection key_."""
        if type(value) is not ast.Constant:
            return ""
        if type(value.value) is not str:
            return ""
        return value.value

    def reference(
        self, value: ast.AST, seen: set[int]
    ) -> PythonDynamicImportReferenceProtocol:
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
