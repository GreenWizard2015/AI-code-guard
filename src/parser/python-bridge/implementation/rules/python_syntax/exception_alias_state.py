from __future__ import annotations

import ast

from implementation.references.aliases.container_aliases import PythonContainerAliases
from implementation.references.aliases.protocols import PythonContainerAliasesProtocol
from implementation.references.aliases.container_keys import PythonContainerKeys
from implementation.references.aliases.container_values import PythonContainerValues
from implementation.references.aliases.reference_aliases import PythonReferenceAliases


class PythonExceptionAliasState:
    """Responsibilities: _exception alias state_."""

    def _imported_exception(self, node: ast.AST) -> None:
        """Responsibilities: _imported exception aliases_."""
        if type(node) is not ast.ImportFrom:
            return
        if node.module != "builtins":
            return
        for imported in node.names:
            if imported.name not in {"Exception", "BaseException"}:
                continue
            local_name = imported.name
            if imported.asname is not None:
                local_name = imported.asname
            self.broad_exception_names.add(local_name)

    def _imported_module(self, node: ast.AST) -> None:
        """Responsibilities: _imported builtin aliases_."""
        if type(node) is not ast.Import:
            return
        for imported in node.names:
            if imported.name != "builtins":
                continue
            local_name = imported.name
            if imported.asname is not None:
                local_name = imported.asname
            self.module_names.add(local_name)

    def _assignment_name(self, value: ast.AST) -> str:
        """Responsibilities: _assigned exception name_."""
        if type(value) is ast.Name:
            return value.id
        if type(value) is ast.Attribute:
            return value.attr
        if type(value) is ast.Subscript:
            resolved = self.container_values.container_value(value)
            if resolved.found():
                return self._assignment_name(resolved.expression_node())
        return ""

    def _broad_getattr(self, value: ast.Call) -> bool:
        """Responsibilities: _reflected broad exception_."""
        if type(value.func) is not ast.Name:
            return False
        if value.func.id != "getattr":
            return False
        if len(value.args) < 2:
            return False
        target = value.args[0]
        if type(target) is not ast.Name:
            return False
        if target.id not in self.module_names:
            return False
        name = self.container_keys.static_key(value.args[1])
        return name in self.broad_exception_names

    def _broad_attribute(self, value: ast.Attribute) -> bool:
        """Responsibilities: _qualified broad exception_."""
        target = value.value
        if type(target) is not ast.Name:
            return False
        if target.id not in self.module_names:
            return False
        return value.attr in self.broad_exception_names

    def _configure_assignment_targets(
        self, targets: list[ast.AST], value: ast.AST
    ) -> None:
        """Responsibilities: _exception alias assignments_."""
        for target in targets:
            for target_name, target_value in self.assignment_aliases.target_values(
                target, value, references_only=False
            ).items():
                name = self._assignment_name(target_value)
                if name in self.module_names:
                    self.module_names.add(target_name)
                if name in self.broad_exception_names:
                    self.broad_exception_names.add(target_name)

    def _multi_source(self, source: ast.AST) -> bool:
        """Responsibilities: _multiple exception source_."""
        if type(source) is ast.Tuple:
            return self._tuple_many(source)
        if type(source) is ast.Call:
            return len(self.container_values.container_values(source)) > 1
        if type(source) is ast.Name:
            return source.id in self.multi_exception_names
        return False

    def _tuple_many(self, source: ast.Tuple) -> bool:
        """Responsibilities: _multiple tuple values_."""
        expanded: list[ast.AST] = []
        for item in source.elts:
            if type(item) is ast.Starred:
                expanded.extend(self.container_values.container_values(item.value))
                continue
            expanded.append(item)
        return len(expanded) > 1

    def _configure_tuple_targets(self, targets: list[ast.AST], value: ast.AST) -> None:
        """Responsibilities: _tuple exception aliases_."""
        target_values: dict[str, ast.AST] = {}
        for target in targets:
            target_values.update(
                self.assignment_aliases.target_values(
                    target, value, references_only=False
                )
            )
        for target, source in target_values.items():
            if self._multi_source(source):
                self.multi_exception_names.add(target)

    def _configure_assignment(self, node: ast.AST) -> None:
        """Responsibilities: _exception assignment aliases_."""
        if type(node) is ast.Assign:
            self._configure_assignment_targets(node.targets, node.value)
            self._configure_tuple_targets(node.targets, node.value)
            return
        if type(node) is not ast.AnnAssign:
            return
        if node.value is None:
            return
        self._configure_assignment_targets([node.target], node.value)
        self._configure_tuple_targets([node.target], node.value)

    def __init__(self) -> None:
        """Responsibilities: _initialization exception aliases_."""
        self.broad_exception_names: set[str] = {"Exception", "BaseException"}
        self.module_names: set[str] = {"builtins"}
        self.multi_exception_names: set[str] = set()
        self.assignment_aliases: PythonReferenceAliases = PythonReferenceAliases()
        self.container_aliases: PythonContainerAliasesProtocol = (
            PythonContainerAliases()
        )
        self.container_keys: PythonContainerKeys = PythonContainerKeys(
            self.container_aliases
        )
        self.container_values: PythonContainerValues = PythonContainerValues(
            self.container_aliases
        )

    def configure_imports(self, tree: ast.AST) -> None:
        """Responsibilities: _exception alias configuration_."""
        if type(tree) is not ast.Module:
            return
        self.container_aliases.clear()
        for node in tree.body:
            self.observe(node)

    def observe(self, node: ast.AST) -> None:
        """Responsibilities: _exception alias observation_."""
        self.container_aliases.observe(node)
        self._imported_exception(node)
        self._imported_module(node)
        self._configure_assignment(node)

    def broad(self, value: ast.AST) -> bool:
        """Responsibilities: _broad exception classification_."""
        if type(value) is ast.Name:
            return value.id in self.broad_exception_names
        if type(value) is ast.Call:
            return self._broad_getattr(value)
        if type(value) is ast.Attribute:
            return self._broad_attribute(value)
        if type(value) is ast.Subscript:
            resolved = self.container_values.container_value(value)
            if not resolved.found():
                return False
            return self.broad(resolved.expression_node())
        return False
