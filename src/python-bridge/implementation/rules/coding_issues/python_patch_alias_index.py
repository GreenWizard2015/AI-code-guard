from __future__ import annotations

import ast
from collections.abc import Sequence

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.constants import (
    PYTHON_BUILTINS_MODULE,
    PYTHON_BUILTINS_SETATTR,
    PYTHON_MOCK_FACTORIES,
    PYTHON_MOCK_IMPORTS,
    PYTHON_MOCK_MODULE,
    PYTHON_MOCK_MODULES,
    PYTHON_OBJECT_SETATTR,
    PYTHON_PATCH_API_NAMES,
    PYTHON_PATCH_API_PREFIXES,
    PYTHON_QUALIFIED_NAME_SEPARATOR,
    PYTHON_SETATTR,
    PYTHON_SHORT_MOCK_MODULE,
    PYTHON_UNITTEST_MODULE,
)


class PythonPatchAliasIndex:
    """Responsibilities: _callable replacement identities_, _patch API resolution_."""

    _aliases: dict[str, str]
    _callable_names: set[str]

    def _import_from_aliases(self, imported_module: ast.ImportFrom) -> None:
        """Responsibilities: _imported patch identity collection_."""
        for imported in imported_module.names:
            local_name = imported.asname or imported.name
            if imported_module.module == PYTHON_BUILTINS_MODULE and imported.name == PYTHON_SETATTR:
                self._aliases[local_name] = PYTHON_BUILTINS_SETATTR
            if imported_module.module in PYTHON_MOCK_MODULES and imported.name in PYTHON_MOCK_IMPORTS:
                self._aliases[local_name] = f"{imported_module.module}.{imported.name}"
            if imported_module.module == PYTHON_UNITTEST_MODULE and imported.name == PYTHON_SHORT_MOCK_MODULE:
                self._aliases[local_name] = PYTHON_MOCK_MODULE

    def _import_module_aliases(self, imported_module: ast.Import) -> None:
        """Responsibilities: _module alias collection_."""
        for imported in imported_module.names:
            if imported.asname is None:
                continue
            if imported.name in PYTHON_MOCK_MODULES | {PYTHON_BUILTINS_MODULE}:
                self._aliases[imported.asname] = imported.name

    def _alias_value(self, value: ast.expr) -> str:
        """Responsibilities: _qualified alias target resolution_."""
        if type(value) is ast.Name:
            return self._aliases.get(value.id, "")
        if type(value) is ast.Attribute and type(value.value) is ast.Name:
            owner = self._aliases.get(value.value.id, value.value.id)
            return PYTHON_QUALIFIED_NAME_SEPARATOR.join((owner, value.attr))
        return ""

    def _is_patch_alias(self, qualified_name: str) -> bool:
        """Responsibilities: _patch alias eligibility_."""
        if qualified_name in PYTHON_PATCH_API_NAMES:
            return True
        return any(qualified_name.startswith(prefix) for prefix in PYTHON_PATCH_API_PREFIXES)

    def _record_alias_targets(self, targets: list[ast.expr], qualified_name: str) -> bool:
        """Responsibilities: _patch alias registration_."""
        changed = False
        for target in targets:
            if type(target) is ast.Name and target.id not in self._aliases:
                self._aliases[target.id] = qualified_name
                changed = True
        return changed

    def _alias_assignment(self, assignment: ast.AST) -> bool:
        """Responsibilities: _patch alias assignment recognition_."""
        if type(assignment) is ast.Assign:
            targets = assignment.targets
            value = assignment.value
        else:
            if type(assignment) is not ast.AnnAssign or assignment.value is None:
                return False
            targets = [assignment.target]
            value = assignment.value
        qualified_name = self._alias_value(value)
        if not self._is_patch_alias(qualified_name):
            return False
        return self._record_alias_targets(targets, qualified_name)

    def _propagate_patch_aliases(self, nodes: list[ast.AST]) -> None:
        """Responsibilities: _patch alias closure_."""
        changed = True
        while changed:
            changed = False
            for node in nodes:
                if self._alias_assignment(node):
                    changed = True

    def _callable_assignment(self, assignment: ast.AST, names: set[str]) -> set[str]:
        """Responsibilities: _callable alias extraction_."""
        if type(assignment) is ast.Assign:
            targets = assignment.targets
            value = assignment.value
        else:
            if type(assignment) is not ast.AnnAssign or assignment.value is None:
                return set()
            targets = [assignment.target]
            value = assignment.value
        if not self._is_callable(value, names):
            return set()
        return {target.id for target in targets if type(target) is ast.Name}

    def _expand_callable_names(self, assignments: Sequence[ast.AST]) -> None:
        """Responsibilities: _callable alias closure_."""
        changed = True
        while changed:
            changed = False
            for assignment in assignments:
                names = self._callable_assignment(assignment, self._callable_names)
                names.difference_update(self._callable_names)
                if names:
                    self._callable_names.update(names)
                    changed = True

    def _collect_callable_names(self, nodes: list[ast.AST]) -> None:
        """Responsibilities: _callable declaration collection_."""
        for node in nodes:
            if type(node) is ast.FunctionDef or type(node) is ast.AsyncFunctionDef:
                self._callable_names.add(node.name)
        self._callable_names.update(
            name for name, qualified in self._aliases.items() if qualified in PYTHON_MOCK_FACTORIES
        )
        assignments = [node for node in nodes if type(node) is ast.Assign or type(node) is ast.AnnAssign]
        self._expand_callable_names(assignments)

    def _is_callable(self, callable_expression: ast.AST, known_names: set[str]) -> bool:
        """Responsibilities: _callable expression classification_."""
        if type(callable_expression) is ast.Lambda:
            return True
        if type(callable_expression) is ast.Name:
            return callable_expression.id in known_names
        if type(callable_expression) is not ast.Call:
            return False
        return self._dotted_name(callable_expression.func) in PYTHON_MOCK_FACTORIES

    def _dotted_name(self, qualified_expression: ast.AST) -> str:
        """Responsibilities: _qualified API name resolution_."""
        parts: list[str] = []
        current = qualified_expression
        while type(current) is ast.Attribute:
            parts.append(current.attr)
            current = current.value
        if type(current) is not ast.Name:
            return ""
        parts.append(current.id)
        parts.reverse()
        parts[0] = self._aliases.get(parts[0], parts[0])
        return PYTHON_QUALIFIED_NAME_SEPARATOR.join(parts)

    def __init__(self) -> None:
        """Responsibilities: _patch alias state initialization_."""
        self._aliases = {}
        self._callable_names = set()

    def patch_call(self, call_expression: ast.AST) -> bool:
        """Responsibilities: _patch API call classification_."""
        if type(call_expression) is not ast.Call:
            return False
        return self._is_patch_alias(self._dotted_name(call_expression.func))

    def callable_replacement(self, replacement_expression: ast.AST) -> bool:
        """Responsibilities: _callable replacement classification_."""
        if type(replacement_expression) is ast.Lambda:
            return True
        if type(replacement_expression) is ast.Name:
            return replacement_expression.id in self._callable_names
        if type(replacement_expression) is not ast.Call:
            return False
        return self._dotted_name(replacement_expression.func) in PYTHON_MOCK_FACTORIES

    def dynamic_replacement(self, call_expression: ast.AST) -> bool:
        """Responsibilities: _dynamic patch replacement detection_."""
        if type(call_expression) is not ast.Call or len(call_expression.args) < 3:
            return False
        patch_names = {PYTHON_SETATTR, PYTHON_BUILTINS_SETATTR, PYTHON_OBJECT_SETATTR}
        if self._dotted_name(call_expression.func) not in patch_names:
            return False
        attribute_name = call_expression.args[1]
        return type(attribute_name) is ast.Constant and type(attribute_name.value) is str

    def collect(self, tree: ast.Module, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _patch alias index_."""
        nodes = node_index.nodes(tree)
        for node in nodes:
            if type(node) is ast.ImportFrom:
                self._import_from_aliases(node)
            if type(node) is ast.Import:
                self._import_module_aliases(node)
        self._propagate_patch_aliases(nodes)
        self._collect_callable_names(nodes)
