from __future__ import annotations


from typing import Any
import ast

from implementation.rules.constants import IMPORT_SCOPE_TYPES, SYS_PATH_MUTATING
from implementation.types import JsonObject


class ImportRules:
    """Responsibilities: _classification Python imports path_."""

    def _path_target(self, target: ast.AST) -> bool:
        """Responsibilities: _sys.path targets identification_."""
        if type(target) is ast.Attribute:
            value: Any = target.value
            is_system_name = type(value) is ast.Name
            return is_system_name and target.attr == "path" and value.id == "sys"
        if type(target) is not ast.Subscript:
            return False
        value: Any = target.value
        if type(value) is not ast.Attribute or value.attr != "path":
            return False
        if type(value.value) is not ast.Name:
            return False
        return value.value.id == "sys"

    def _path_call(self, node: ast.Call) -> bool:
        """Responsibilities: _identification invocation mutate sys_."""
        function: Any = node.func
        if type(function) is not ast.Attribute:
            return False
        value: Any = function.value
        if type(value) is not ast.Attribute or value.attr != "path":
            return False
        if type(value.value) is not ast.Name:
            return False
        is_system_name = value.value.id == "sys"
        return is_system_name and function.attr in self.sys_path_mutating

    def _path_mutation(self, node: ast.AST) -> bool:
        """Responsibilities: _classification statements mutate Python_."""
        if type(node) is ast.Call:
            return self._path_call(node)
        targets: list[ast.AST] = []
        if type(node) in (ast.Assign, ast.Delete):
            targets: Any = node.targets
        if type(node) in (ast.AnnAssign, ast.AugAssign):
            targets: Any = [node.target]
        return any(self._path_target(target) for target in targets)

    def _is_import_preamble(self, node: ast.stmt) -> bool:
        """Responsibilities: _classification imports module preamble_."""
        if type(node) is ast.Expr:
            if type(node.value) is ast.Constant:
                return type(node.value.value) is str
            return False
        if type(node) is ast.ImportFrom:
            return node.module == "__future__"
        return False

    def _late_import_issues(self, body: list[ast.stmt]) -> list[JsonObject]:
        """Responsibilities: _reporting imports occur after_."""
        issues: list[JsonObject] = []
        imports_closed: Any = False
        for node in body:
            if self._is_import_preamble(node):
                continue
            is_import: Any = type(node) in (ast.Import, ast.ImportFrom)
            if not is_import:
                imports_closed: Any = True
            else:
                if imports_closed:
                    issues.append({"line": max(0, node.lineno - 1), "kind": "late"})
        return issues

    def _is_dynamic_import(self, node: ast.AST) -> bool:
        """Responsibilities: _identification dynamic import invocation_."""
        if type(node) is not ast.Call:
            return False
        function: Any = node.func
        if type(function) is ast.Name:
            return function.id == "__import__"
        is_named_attribute = type(function) is ast.Attribute
        if is_named_attribute:
            is_named_attribute = type(function.value) is ast.Name
        if not is_named_attribute:
            return False
        is_importlib = function.value.id == "importlib"
        if not is_importlib:
            return False
        return function.attr == "import_module"

    def __init__(self) -> None:
        """Responsibilities: _import rule configuration initialization_."""
        self.import_scope_types: Any = IMPORT_SCOPE_TYPES
        self.sys_path_mutating: Any = SYS_PATH_MUTATING

    def collect_import_issues(
        self, node: ast.AST, issues: list[JsonObject], nested: bool
    ) -> None:
        """Responsibilities: _collection path mutation nested_."""
        if type(node) in (ast.Import, ast.ImportFrom) and nested:
            issues.append({"line": max(0, node.lineno - 1), "kind": "nested"})
        if type(node) is ast.ImportFrom and node.level > 0:
            issues.append({"line": max(0, node.lineno - 1), "kind": "relative"})
        if self._is_dynamic_import(node):
            issues.append({"line": max(0, node.lineno - 1), "kind": "dynamic"})
        if self._path_mutation(node):
            issues.append(
                {"line": max(0, node.lineno - 1), "kind": "sys_path_mutation"}
            )
        child_nested: Any = nested
        if type(node) in IMPORT_SCOPE_TYPES:
            child_nested: Any = True
        for child in ast.iter_child_nodes(node):
            self.collect_import_issues(child, issues, child_nested)

    def import_issues(self, tree: ast.Module) -> list[JsonObject]:
        """Responsibilities: _collection import issues module_."""
        issues: list[JsonObject] = []
        self.collect_import_issues(tree, issues, False)
        issues.extend(self._late_import_issues(tree.body))
        return issues
