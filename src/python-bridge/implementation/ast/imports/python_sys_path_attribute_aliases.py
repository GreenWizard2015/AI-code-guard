from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.constants import (
    PYTHON_FUNCTION_KIND,
    PYTHON_STATIC_METHOD_DECORATOR,
    SYS_PATH_INSTANCE_OWNER,
)


class PythonSysPathAttributeAliases:
    """Responsibilities: _instance path alias ownership_, _attribute path keys_."""

    def _static_method(self, function_scope: ast.AST) -> bool:
        """Responsibilities: _static method detection_."""
        for decorator in function_scope.decorator_list:
            if type(decorator) is ast.Name:
                if decorator.id == PYTHON_STATIC_METHOD_DECORATOR:
                    return True
            if type(decorator) is ast.Attribute:
                if decorator.attr == PYTHON_STATIC_METHOD_DECORATOR:
                    return True
        return False

    def _append_scope_owner(
        self, scopes: dict[str, ast.AST], parent: ast.AST, context: ast.AST
    ) -> None:
        """Responsibilities: _lexical owner accumulation_."""
        scopes["root"] = parent
        if scopes[PYTHON_FUNCTION_KIND] is context:
            if type(parent) in (ast.FunctionDef, ast.AsyncFunctionDef):
                scopes[PYTHON_FUNCTION_KIND] = parent
        if scopes["class"] is context and type(parent) is ast.ClassDef:
            scopes["class"] = parent

    def _scope_owners(self, context: ast.AST) -> dict[str, ast.AST]:
        """Responsibilities: _attribute alias lexical scopes_."""
        scopes = {PYTHON_FUNCTION_KIND: context, "class": context, "root": context}
        current = context
        while True:
            parents = self.node_index.parents(current)
            if not parents:
                break
            parent = parents[0]
            self._append_scope_owner(scopes, parent, context)
            current = parent
        return scopes

    def _receiver_name(self, function_scope: ast.AST, class_scope: ast.AST) -> str:
        """Responsibilities: _instance receiver alias normalization_."""
        if type(class_scope) is not ast.ClassDef:
            return ""
        if type(function_scope) not in (ast.FunctionDef, ast.AsyncFunctionDef):
            return ""
        if self._static_method(function_scope):
            return ""
        arguments = [*function_scope.args.posonlyargs, *function_scope.args.args]
        if not arguments:
            return ""
        return arguments[0].arg

    def _owner_key(self, owner: ast.AST, receiver_name: str) -> str:
        """Responsibilities: _attribute owner identity normalization_."""
        if type(owner) is ast.Name:
            if receiver_name:
                if owner.id == receiver_name:
                    return SYS_PATH_INSTANCE_OWNER
            return f"name:{owner.id}"
        if type(owner) is ast.Attribute:
            return f"{self._owner_key(owner.value, receiver_name)}.{owner.attr}"
        return ast.dump(owner, include_attributes=False)

    def _instance_scope(
        self, scopes: dict[str, ast.AST], target: ast.Attribute, receiver_name: str
    ) -> ast.AST:
        """Responsibilities: _instance alias scope_."""
        scope = scopes[PYTHON_FUNCTION_KIND]
        if not receiver_name:
            return scope
        if not self._is_receiver(target.value, receiver_name):
            return scope
        return scopes["class"]

    def _is_receiver(self, owner: ast.AST, receiver_name: str) -> bool:
        """Responsibilities: _instance receiver identity_."""
        if type(owner) is not ast.Name:
            return False
        return owner.id == receiver_name

    def _attribute_path_key(self, target: ast.Attribute, context: ast.AST) -> str:
        """Responsibilities: _instance path field identity_."""
        scopes = self._scope_owners(context)
        function_scope = scopes[PYTHON_FUNCTION_KIND]
        class_scope = scopes["class"]
        receiver_name = self._receiver_name(function_scope, class_scope)
        scope = self._instance_scope(scopes, target, receiver_name)
        if function_scope is context:
            scope = scopes["root"]
        owner_key = self._owner_key(target.value, receiver_name)
        return f"{id(scope)}:{owner_key}:{target.attr}"

    def __init__(self, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _attribute alias index setup_."""
        self.node_index: PythonAstNodeIndexContract = node_index
        self.keys: set[str] = set()

    def record(self, target: ast.Attribute, context: ast.AST) -> None:
        """Responsibilities: _attribute path alias indexing_."""
        self.keys.add(self._attribute_path_key(target, context))

    def contains(self, target: ast.Attribute) -> bool:
        """Responsibilities: _attribute path alias lookup_."""
        return self._attribute_path_key(target, target) in self.keys
