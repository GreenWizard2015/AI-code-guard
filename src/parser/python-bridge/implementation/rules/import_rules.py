from __future__ import annotations


from typing import Any
import ast

from implementation.rules.constants import IMPORT_SCOPE_TYPES
from implementation.rules.python_syntax.dynamic_import_names import (
    PythonDynamicImportNames,
)
from implementation.rules.sys_path_rules.sys_path_rules import PythonSysPathRules
from implementation.types import JsonObject


class ImportRules:
    """Responsibilities: _classification Python imports path_."""

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
        return self.dynamic_import_names.matches(node.func)

    def _append_node_issues(
        self, node: ast.AST, issues: list[JsonObject], nested: bool
    ) -> None:
        """Responsibilities: _collection current import issues_."""
        self.dynamic_import_names.observe(node)
        if type(node) in (ast.Import, ast.ImportFrom) and nested:
            issues.append({"line": max(0, node.lineno - 1), "kind": "nested"})
        if type(node) is ast.ImportFrom and node.level > 0:
            issues.append({"line": max(0, node.lineno - 1), "kind": "relative"})
        if self._is_dynamic_import(node):
            issues.append({"line": max(0, node.lineno - 1), "kind": "dynamic"})
        if self.sys_path_rules.path_mutation(node):
            issues.append(
                {"line": max(0, node.lineno - 1), "kind": "sys_path_mutation"}
            )

    def __init__(self) -> None:
        """Responsibilities: _import rule configuration initialization_."""
        self.import_scope_types: Any = IMPORT_SCOPE_TYPES
        self.dynamic_import_names: PythonDynamicImportNames = PythonDynamicImportNames()
        self.sys_path_rules: PythonSysPathRules = PythonSysPathRules()

    def collect_import_issues(
        self, node: ast.AST, issues: list[JsonObject], nested: bool
    ) -> None:
        """Responsibilities: _collection path mutation nested_."""
        self._append_node_issues(node, issues, nested)
        child_nested: Any = nested
        if type(node) in IMPORT_SCOPE_TYPES:
            child_nested: Any = True
        for child in ast.iter_child_nodes(node):
            self.collect_import_issues(child, issues, child_nested)

    def import_issues(self, tree: ast.Module) -> list[JsonObject]:
        """Responsibilities: _collection import issues module_."""
        self.dynamic_import_names.configure(tree)
        self.sys_path_rules.configure(tree)
        issues: list[JsonObject] = []
        self.collect_import_issues(tree, issues, False)
        issues.extend(self._late_import_issues(tree.body))
        return issues
