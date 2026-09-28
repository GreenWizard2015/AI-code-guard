from __future__ import annotations

import ast

from implementation.references.aliases.reference_aliases import PythonReferenceAliases
from implementation.references.aliases.container_aliases import PythonContainerAliases
from implementation.references.aliases.protocols import PythonContainerAliasesProtocol

class PythonDecoratorRules:
    """Responsibilities: _classification Python decorators_."""

    def _named_kind(self, decorator: ast.AST) -> str:
        """Responsibilities: _classification named decorator_."""
        if type(decorator) is not ast.Name:
            return ""
        if decorator.id in self.static_method_names:
            return "python-static-method"
        if decorator.id in self.class_method_names:
            return "python-class-method"
        if decorator.id in self.property_setter_names:
            return "python-property-setter"
        return ""

    def _qualified_kind(self, decorator: ast.AST) -> str:
        """Responsibilities: _classification qualified decorator_."""
        if type(decorator) is not ast.Attribute:
            return ""
        if decorator.attr == "staticmethod":
            return "python-static-method"
        if decorator.attr == "classmethod":
            return "python-class-method"
        if decorator.attr == "setter":
            return "python-property-setter"
        return ""

    def _decorator_kind(self, decorator: ast.AST) -> str:
        """Responsibilities: _classification decorator kind_."""
        kind = self._named_kind(decorator)
        if kind:
            return kind
        kind = self._qualified_kind(decorator)
        if kind:
            return kind
        return self._subscript_kind(decorator)

    def _subscript_kind(self, decorator: ast.AST) -> str:
        """Responsibilities: _classification subscript decorator kind_."""
        if type(decorator) is not ast.Subscript:
            return ""
        resolved = self.container_aliases.values.container_value(decorator)
        if not resolved.found():
            return ""
        return self._resolved_kind(resolved.expression_node())

    def _resolved_kind(self, expression: ast.AST) -> str:
        """Responsibilities: _classification resolved decorator kind_."""
        kind = self._named_kind(expression)
        if kind:
            return kind
        return self._qualified_kind(expression)

    def _local_name(self, imported: ast.alias) -> str:
        """Responsibilities: _resolution imported decorator name_."""
        local_name = imported.name
        if imported.asname is not None:
            local_name = imported.asname
        return local_name

    def _configure_import(self, imported: ast.alias) -> None:
        """Responsibilities: _configuration imported decorator alias_."""
        local_name = self._local_name(imported)
        if imported.name == "staticmethod":
            self.static_method_names.add(local_name)
        if imported.name == "classmethod":
            self.class_method_names.add(local_name)
        if imported.name == "property":
            self.property_names.add(local_name)

    def _assignment_name(self, value: ast.AST) -> str:
        """Responsibilities: _resolution assigned decorator name_."""
        if type(value) is ast.Name:
            return value.id
        if type(value) is ast.Attribute:
            return value.attr
        if type(value) is ast.Subscript:
            resolved = self.container_aliases.values.container_value(value)
            if resolved.found():
                return self._assignment_name(resolved.expression_node())
        return ""

    def _configure_alias_set(self, names: set[str], target: str, source: str) -> None:
        """Responsibilities: _decorator alias membership_."""
        names.discard(target)
        if source in names:
            names.add(target)

    def _configure_assignment_targets(
        self, targets: list[ast.AST], value: ast.AST
    ) -> None:
        """Responsibilities: _configuration assigned decorator aliases_."""
        target_values: dict[str, ast.AST] = {}
        for target in targets:
            target_values.update(self.assignment_aliases.target_values(target, value, references_only=False))
        for target, source in target_values.items():
            name = self._assignment_name(source)
            self._configure_target(target, source, name)

    def _configure_target(self, target: str, source: ast.AST, name: str) -> None:
        """Responsibilities: _decorator target alias configuration_."""
        self._configure_alias_set(self.static_method_names, target, name)
        self._configure_alias_set(self.class_method_names, target, name)
        self._configure_alias_set(self.property_names, target, name)
        self.property_setter_names.discard(target)
        is_setter = False
        if type(source) is ast.Attribute:
            is_setter = source.attr == "setter"
        if is_setter:
            self.property_setter_names.add(target)
            return
        if name in self.property_setter_names:
            self.property_setter_names.add(target)

    def _configure_assignment(self, node: ast.AST) -> None:
        """Responsibilities: _configuration decorator assignment aliases_."""
        if type(node) is ast.Assign:
            self._configure_assignment_targets(node.targets, node.value)
            return
        if type(node) is not ast.AnnAssign:
            return
        if node.value is None:
            return
        self._configure_assignment_targets([node.target], node.value)

    def _is_function(self, node: ast.AST) -> bool:
        """Responsibilities: _decorated function classification_."""
        if type(node) is ast.FunctionDef:
            return True
        return type(node) is ast.AsyncFunctionDef

    def __init__(self) -> None:
        """Responsibilities: _configuration decorator names_."""
        self.static_method_names: set[str] = {"staticmethod"}
        self.class_method_names: set[str] = {"classmethod"}
        self.property_names: set[str] = {"property"}
        self.property_setter_names: set[str] = set()
        self.assignment_aliases: PythonReferenceAliases = PythonReferenceAliases()
        self.container_aliases: PythonContainerAliasesProtocol = PythonContainerAliases()

    def configure_imports(self, tree: ast.AST) -> None:
        """Responsibilities: _configuration builtin decorator aliases_."""
        if type(tree) is not ast.Module:
            return
        for node in tree.body:
            self.observe(node)

    def observe(self, node: ast.AST) -> None:
        """Responsibilities: _observation decorator aliases_."""
        self.container_aliases.observe(node)
        if type(node) is ast.ImportFrom:
            if node.module == "builtins":
                for imported in node.names:
                    self._configure_import(imported)
        self._configure_assignment(node)

    def property_decorator(self, decorator: ast.AST) -> bool:
        """Responsibilities: _identification property decorator_."""
        if type(decorator) is ast.Name:
            return decorator.id in self.property_names
        if type(decorator) is ast.Attribute:
            return decorator.attr == "property"
        if type(decorator) is ast.Subscript:
            resolved = self.container_aliases.values.container_value(decorator)
            if not resolved.found():
                return False
            return self.property_decorator(resolved.expression_node())
        return False

    def kinds(self, node: ast.AST) -> list[str]:
        """Responsibilities: _collection decorator rule kinds_."""
        if not self._is_function(node):
            return []
        kinds: list[str] = []
        for decorator in node.decorator_list:
            kind = self._decorator_kind(decorator)
            if kind:
                kinds.append(kind)
        return kinds
