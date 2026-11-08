from __future__ import annotations

import ast
from typing import cast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.constants import (
    IMPORT_OBSERVER_NODE_TYPES,
    SYS_PATH_MUTATION_NODE_TYPES,
)
from implementation.rules.python_syntax.protocols import (
    PythonDynamicImportNamesContract,
)
from implementation.types import JsonObject, PythonASTLocatedNode
from protocols import PythonSysPathRulesContract


class ImportRules:
    """Responsibilities: _import preamble validation_, _dynamic import detection_."""

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
        imports_closed = False
        for node in body:
            if self._is_import_preamble(node):
                continue
            is_import = type(node) in (ast.Import, ast.ImportFrom)
            if not is_import:
                imports_closed = True
            else:
                if imports_closed:
                    issues.append({"line": max(0, node.lineno - 1), "kind": "late"})
        return issues

    def _is_dynamic_import(self, call_candidate: ast.AST) -> bool:
        """Responsibilities: _identification dynamic import invocation_."""
        if type(call_candidate) is not ast.Call:
            return False
        return self._dynamic_import_names.matches(call_candidate.func)

    def _path_mutation(self, node: ast.AST) -> bool:
        """Responsibilities: _sys.path mutation classification_."""
        if type(node) not in SYS_PATH_MUTATION_NODE_TYPES:
            return False
        return self._sys_path_rules.path_mutation(node)

    def _append_node_issues(
        self,
        syntax_node: ast.AST,
        issues: list[JsonObject],
        nested: bool,
    ) -> None:
        """Responsibilities: _collection current import issues_."""
        if type(syntax_node) in IMPORT_OBSERVER_NODE_TYPES:
            self._dynamic_import_names.observe(syntax_node)
        kinds: list[str] = []
        if nested and type(syntax_node) in (ast.Import, ast.ImportFrom):
            kinds.append("nested")
        if type(syntax_node) is ast.ImportFrom and syntax_node.level > 0:
            kinds.append("relative")
        if self._is_dynamic_import(syntax_node):
            kinds.append("dynamic")
        if self._path_mutation(syntax_node):
            kinds.append("sys_path_mutation")
        if kinds:
            line = max(0, cast(PythonASTLocatedNode, syntax_node).lineno - 1)
            issues.extend({"line": line, "kind": kind} for kind in kinds)

    def __init__(
        self,
        dynamic_import_names: PythonDynamicImportNamesContract,
        sys_path_rules: PythonSysPathRulesContract,
        node_index: PythonAstNodeIndexContract,
    ) -> None:
        """Responsibilities: _import rule configuration initialization_."""
        self._dynamic_import_names: PythonDynamicImportNamesContract = dynamic_import_names
        self._sys_path_rules: PythonSysPathRulesContract = sys_path_rules
        self._node_index: PythonAstNodeIndexContract = node_index

    def collect_import_issues(
        self,
        tree: ast.Module,
        issues: list[JsonObject],
    ) -> None:
        """Responsibilities: _indexed import issue collection_."""
        scopes = self._node_index.scopes(tree)
        for statement in tree.body:
            for syntax_node in self._node_index.nodes(statement):
                nested = scopes[syntax_node] != "module"
                self._append_node_issues(syntax_node, issues, nested)

    def import_issues(self, tree: ast.Module) -> list[JsonObject]:
        """Responsibilities: _collection import issues module_."""
        self._dynamic_import_names.configure()
        self._sys_path_rules.configure(tree)
        issues: list[JsonObject] = []
        self.collect_import_issues(tree, issues)
        issues.extend(self._late_import_issues(tree.body))
        return issues
