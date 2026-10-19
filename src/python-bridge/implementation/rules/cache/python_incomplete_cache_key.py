from __future__ import annotations

import ast
from collections.abc import Sequence

from implementation.protocols import PythonAstNodeIndexContract
from implementation.rules.protocols import (
    PythonCacheDiagnosticsContract,
    PythonCacheNodeExecutionContract,
    PythonCacheReadStateContract,
)
from implementation.rules.cache.python_cache_diagnostics import PythonCacheDiagnostics
from implementation.rules.cache.python_cache_control_flow import PythonCacheControlFlow
from implementation.rules.cache.python_cache_read_state import PythonCacheReadState
from implementation.types import JsonObject


class PythonIncompleteCacheKey(PythonCacheNodeExecutionContract):
    """Responsibilities: _cache key analysis_, _control-flow state evaluation_."""

    _node_index: PythonAstNodeIndexContract
    _diagnostics: PythonCacheDiagnosticsContract
    _control_flow: PythonCacheControlFlow

    def _append_mismatch(
        self, current: ast.Call, reads: PythonCacheReadStateContract, key: str
    ) -> bool:
        """Responsibilities: _cache key mismatch detection_."""
        if type(current.func) is not ast.Attribute:
            return False
        receiver = self.cache_key(current.func.value)
        if not any(read_key != key for read_key in reads.keys_for(receiver)):
            return False
        self._diagnostics.append(current.lineno - 1)
        return True

    def _append_operation(
        self, current: ast.Call, reads: PythonCacheReadStateContract
    ) -> None:
        """Responsibilities: _cache operation analysis_."""
        if type(current.func) is not ast.Attribute or not current.args:
            return
        receiver = self.cache_key(current.func.value)
        key = self.cache_key(current.args[0])
        if current.func.attr == "get":
            reads.record(receiver, key)
            return
        if current.func.attr == "set":
            self._append_mismatch(current, reads, key)

    def _append_callable(self, node: ast.AST) -> None:
        """Responsibilities: _callable cache analysis_."""
        if type(node) is ast.FunctionDef:
            self.analyze_nodes(node.body, PythonCacheReadState(set()))
        if type(node) is ast.AsyncFunctionDef:
            self.analyze_nodes(node.body, PythonCacheReadState(set()))

    def analyze_nodes(
        self,
        nodes: Sequence[ast.AST],
        state: PythonCacheReadStateContract,
    ) -> PythonCacheReadStateContract:
        """Responsibilities: _ordered cache operations_."""
        current = state
        for node in nodes:
            current = self.analyze_node(node, current)
        return current

    def _execute_assignment(
        self,
        node: ast.AST,
        state: PythonCacheReadStateContract,
    ) -> PythonCacheReadStateContract:
        """Responsibilities: _assignment expression state_."""
        if type(node) is ast.Assign:
            return self.analyze_nodes([node.value, *node.targets], state)
        if type(node) is ast.AnnAssign:
            expressions = [node.annotation]
            if node.value is not None:
                expressions.append(node.value)
            expressions.append(node.target)
            return self.analyze_nodes(expressions, state)
        return state

    def _execute_call(
        self, node: ast.Call, state: PythonCacheReadStateContract
    ) -> PythonCacheReadStateContract:
        """Responsibilities: _cache state transition_."""
        current = self.analyze_nodes(list(ast.iter_child_nodes(node)), state)
        self._append_operation(node, current)
        return current

    def analyze_node(
        self, node: ast.AST, state: PythonCacheReadStateContract
    ) -> PythonCacheReadStateContract:
        """Responsibilities: _cache syntax evaluation_."""
        if type(node) in (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda):
            return state
        if self._control_flow.matches_control_flow(node):
            return self._control_flow.control_flow_result(node, state)
        if type(node) is ast.Call:
            return self._execute_call(node, state)
        if type(node) in (ast.Assign, ast.AnnAssign):
            return self._execute_assignment(node, state)
        return self.analyze_nodes(list(ast.iter_child_nodes(node)), state)

    def __init__(self, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _cache analysis dependency setup_."""
        self._node_index: PythonAstNodeIndexContract = node_index
        self._diagnostics: PythonCacheDiagnosticsContract = PythonCacheDiagnostics()
        self._control_flow: PythonCacheControlFlow = PythonCacheControlFlow(self)

    def cache_key(self, node: ast.AST) -> str:
        """Responsibilities: _cache key representation_."""
        rendered = ast.dump(node)
        if rendered:
            return rendered
        return "<empty>"

    def issues(self, tree: ast.Module) -> list[JsonObject]:
        """Responsibilities: _inconsistent cache key diagnostics_."""
        self._diagnostics.clear()
        for node in self._node_index.nodes(tree):
            if type(node) in (ast.FunctionDef, ast.AsyncFunctionDef):
                self._append_callable(node)
        return self._diagnostics.values()
