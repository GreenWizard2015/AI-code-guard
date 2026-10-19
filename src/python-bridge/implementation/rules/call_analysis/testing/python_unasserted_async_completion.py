from __future__ import annotations

import ast

from implementation.protocols import (
    PythonAsyncNameOverlayContract,
    PythonAstNodeIndexContract,
)
from implementation.references.instances.python_assignment_effects import (
    PythonAssignmentEffects,
)
from implementation.rules.call_analysis.python_async_name_overlay import (
    PythonAsyncNameOverlay,
)
from implementation.rules.call_analysis.testing.python_test_execution_region import (
    PythonTestExecutionRegion,
)
from implementation.types import JsonObject


class PythonUnassertedAsyncCompletion:
    """Responsibilities: _async test discovery_, _unasserted completion reporting_."""

    def _module_import_name(self, imported: ast.alias) -> str:
        """Responsibilities: _import binding names_."""
        if imported.asname is not None:
            return imported.asname
        separator = imported.name.find(".")
        if separator < 0:
            return imported.name
        return imported.name[:separator]

    def _module_assignment_names(self, node: ast.AST, names: set[str]) -> None:
        """Responsibilities: _module async alias transitions_."""
        effects = PythonAssignmentEffects(node)
        if not effects.runtime_value_present():
            return
        value = effects.assigned_value()
        alias = False
        if type(value) is ast.Name:
            alias = value.id in names
        for name in effects.target_names():
            names.discard(name)
            if alias:
                names.add(name)

    def _update_test_aliases(
        self, node: ast.AST, async_names: PythonAsyncNameOverlayContract
    ) -> None:
        """Responsibilities: _test-local async alias transitions_."""
        effects = PythonAssignmentEffects(node)
        if not effects.runtime_value_present():
            return
        value = effects.assigned_value()
        alias = False
        if type(value) is ast.Name:
            alias = async_names.contains(value.id)
        for name in effects.target_names():
            async_names.discard(name)
            if alias:
                async_names.add(name)

    def _async_call_name(
        self,
        node: ast.AST,
        function: ast.AST,
        async_names: PythonAsyncNameOverlayContract,
    ) -> str:
        """Responsibilities: _async invocation identity_."""
        if node is function or type(node) in (
            ast.FunctionDef,
            ast.AsyncFunctionDef,
            ast.Lambda,
        ):
            return ""
        if type(node) is not ast.Expr or type(node.value) is not ast.Call:
            return ""
        if type(node.value.func) is not ast.Name:
            return ""
        name = node.value.func.id
        if not async_names.contains(name):
            return ""
        return name

    def _function_issues(
        self, function: ast.AST, async_names: set[str]
    ) -> list[JsonObject]:
        """Responsibilities: _async issue collection_."""
        region = PythonTestExecutionRegion(function)
        local_names = region.local_names()
        visible_async_names = PythonAsyncNameOverlay(async_names, local_names)
        issues: list[JsonObject] = []
        for node in region.nodes():
            self._update_test_aliases(node, visible_async_names)
            name = self._async_call_name(node, function, visible_async_names)
            if name:
                issues.append(
                    {"line": node.lineno - 1, "kind": self._rule_id, "name": name}
                )
        return issues

    def _apply_async_definition(self, node: ast.AST, names: set[str]) -> bool:
        """Responsibilities: _async module definition registration_."""
        if type(node) is not ast.AsyncFunctionDef:
            return False
        names.add(node.name)
        return True

    def _apply_sync_definition(self, node: ast.AST, names: set[str]) -> bool:
        """Responsibilities: _synchronous name shadowing_."""
        if type(node) not in (ast.FunctionDef, ast.ClassDef):
            return False
        names.discard(node.name)
        return True

    def _apply_module_assignment(self, node: ast.AST, names: set[str]) -> bool:
        """Responsibilities: _module assignment alias transition_."""
        if type(node) not in (ast.Assign, ast.AnnAssign, ast.NamedExpr):
            return False
        self._module_assignment_names(node, names)
        return True

    def _remove_imported_names(self, node: ast.AST, names: set[str]) -> None:
        """Responsibilities: _import binding shadowing_."""
        if type(node) not in (ast.Import, ast.ImportFrom):
            return
        for imported in node.names:
            names.discard(self._module_import_name(imported))

    def __init__(self, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _async completion rule initialization_."""
        self._rule_id: str = "unasserted-async-completion"
        self._node_index: PythonAstNodeIndexContract = node_index

    def module_async_names(self, tree: ast.Module) -> set[str]:
        """Responsibilities: _module async binding lifecycle_."""
        names: set[str] = set()
        for node in tree.body:
            if self._apply_async_definition(node, names):
                continue
            if self._apply_sync_definition(node, names):
                continue
            if self._apply_module_assignment(node, names):
                continue
            self._remove_imported_names(node, names)
        return names

    def test_functions(self, tree: ast.Module) -> list[ast.AST]:
        """Responsibilities: _test function selection_."""
        functions: list[ast.AST] = []
        for node in self._node_index.nodes(tree):
            if type(node) not in (ast.FunctionDef, ast.AsyncFunctionDef):
                continue
            if not node.name.startswith("test_"):
                continue
            functions.append(node)
        return functions

    def issues(self, tree: ast.Module) -> list[JsonObject]:
        """Responsibilities: _async completion diagnostics_."""
        async_names = self.module_async_names(tree)
        issues: list[JsonObject] = []
        for function in self.test_functions(tree):
            issues.extend(self._function_issues(function, async_names))
        return issues
