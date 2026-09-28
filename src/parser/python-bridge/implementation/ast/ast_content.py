from __future__ import annotations


from time import perf_counter
from typing import Any, Callable
from implementation.ast.responsibility_targets import PythonResponsibilityTargets
from implementation.ast.protocols import PythonAstContentTreeProtocol
from implementation.rules.private_access_collector import PythonPrivateAccessCollector
from implementation.types import JsonObject, JsonValue


PythonAstOperation = Callable[[], JsonValue]


class PythonAstContent:
    """Responsibilities: _timed Python AST content_."""

    def _timed(self, stage_name: str, operation: PythonAstOperation) -> JsonValue:
        """Responsibilities: _measurement AST stage_."""
        started = perf_counter()
        try:
            return operation()
        finally:
            self.tree.timings_data()[stage_name] = (perf_counter() - started) * 1000

    def _private_access_structure(self) -> JsonObject:
        """Responsibilities: _collection private access structure_."""
        private_access: Any = PythonPrivateAccessCollector(
            self.tree.tree, self.tree.node_index
        )
        private_members: Any = self._timed("private-members", private_access.member_names)
        private_accesses: Any = self._timed(
            "private-accesses", lambda: private_access.accesses(private_members)
        )
        return {
            "private_accesses": private_accesses,
        }

    def _node_structure(self) -> JsonObject:
        """Responsibilities: _collection AST node structure_."""
        return {
            "classes": self._timed("class-nodes", self.tree._class_nodes),
            "functions": self._timed("function-nodes", self.tree.function_nodes.nodes),
            "python_callable_count": self._timed(
                "callable-count", self.tree.function_nodes.callable_count
            ),
            "parse_issues": [],
            "import_issues": self._timed(
                "import-issues", lambda: self.tree.import_rules.import_issues(self.tree.tree)
            ),
            "attribute_accesses": self._timed(
                "attribute-accesses",
                lambda: self.tree.structure_issues.deep_attribute_accesses(self.tree.tree),
            ),
            "repeated_branches": self._timed(
                "repeated-branches",
                lambda: self.tree.structure_issues.repeated_branches(self.tree.tree),
            ),
        }

    def __init__(self, tree: PythonAstContentTreeProtocol) -> None:
        """Responsibilities: _initialization AST content_."""
        self.tree: PythonAstContentTreeProtocol = tree
        self.responsibility_target_collector: PythonResponsibilityTargets = PythonResponsibilityTargets(
            self.tree.tree, self.tree.node_index
        )

    def structure(self) -> JsonObject:
        """Responsibilities: _collection AST structure_."""
        structure = self._node_structure()
        structure.update(self._private_access_structure())
        structure["parse_issues"] = []
        return structure

    def references(self) -> JsonObject:
        """Responsibilities: _collection AST references_."""
        return {
            "call_references": self._timed(
                "call-references", self.tree.references.collect_references
            ),
            "python_imports": self._timed("python-imports", self.tree._import_nodes),
            "python_main_guard": self._timed("main-guard", self.tree._main_guard_present),
            "reference_aliases": self._timed(
                "reference-aliases", lambda: self.tree.reference_aliases.collect(self.tree.tree)
            ),
            "docstring_spans": self._timed("docstring-spans", self.tree._docstring_spans),
            "responsibility_targets": self._timed(
                "responsibility-targets",
                self.responsibility_target_collector.collect,
            ),
            "coding_issues": self._timed("coding-issues", self.tree.coding_issues),
        }

    def symbols(self) -> JsonObject:
        """Responsibilities: _collection AST symbols_."""
        return {
            "named_symbols": self._timed("named-symbols", lambda: self.tree.symbols.named_symbols),
            "type_declarations": self._timed(
                "type-declarations", lambda: self.tree.symbols.type_declarations
            ),
            "module_instances": self._timed(
                "module-instances", lambda: self.tree.symbols.module_instances
            ),
            "module_constant_spans": self._timed(
                "module-constant-spans", self.tree.module_constants.collect_spans
            ),
            "module_type_spans": self._timed(
                "module-type-spans", self.tree.module_constants.collect_types
            ),
            "module_protocol_spans": self._timed(
                "module-protocol-spans", self.tree.module_constants.collect_protocols
            ),
        }

    def collect(self) -> JsonObject:
        """Responsibilities: _combination AST content_."""
        content = self.structure()
        content.update(self.references())
        content.update(self.symbols())
        return content
