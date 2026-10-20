from __future__ import annotations

from collections.abc import Callable
from time import perf_counter
from typing import Any

from implementation.ast.python_literal_metadata import PythonLiteralMetadata
from implementation.ast.callables.python_ast_reference_content import (
    PythonAstReferenceContent,
)
from implementation.ast.type_declarations.python_responsibility_targets import (
    PythonResponsibilityTargets,
)
from protocols import PythonAstContentTreeContract
from implementation.ast.protocols import PythonPrivateAccessOptionsContract
from implementation.protocols import PythonReflectionNamesContract
from implementation.references.protocols import PythonPrivateVarsMappingContract
from implementation.references.protocols import PythonContainerAliasesContract
from implementation.references.python_private_vars_mapping import (
    PythonPrivateVarsMapping,
)
from implementation.rules.call_analysis.python_builtin_reflection_names import (
    PythonBuiltinReflectionNames,
)
from implementation.rules.call_analysis.python_private_access_collector import (
    PythonPrivateAccessCollector,
)
from implementation.rules.constants import PYTHON_PARSE_ISSUES_KEY
from implementation.rules.call_analysis.python_private_access_options import (
    PythonPrivateAccessOptions,
)
from implementation.types import (
    JsonObject,
    JsonValue,
)

PythonAstOperation = Callable[[], JsonValue]


class PythonAstContent:
    """Responsibilities: _AST structure collection_, _reference data assembly_."""

    def _timed(self, stage_name: str, operation: PythonAstOperation) -> JsonValue:
        """Responsibilities: _measurement AST stage_."""
        started = perf_counter()
        try:
            return operation()
        finally:
            timings = self.tree.timings_data()
            timings[stage_name] = (perf_counter() - started) * 1000

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
                "import-issues",
                lambda: self.tree.import_rules.import_issues(self.tree.tree),
            ),
            "attribute_accesses": self._timed(
                "attribute-accesses",
                lambda: self.tree.structure_issues.deep_attribute_accesses(
                    self.tree.tree
                ),
            ),
            "repeated_branches": self._timed(
                "repeated-branches",
                lambda: self.tree.structure_issues.repeated_branches(self.tree.tree),
            ),
        }

    def _private_access_options(self) -> PythonPrivateAccessOptionsContract:
        """Responsibilities: _construction private access dependencies_."""
        container_aliases = self.tree.container_aliases()
        reflection_names = self._configured_reflection_names(container_aliases)
        private_mapping = self._private_mapping(reflection_names, container_aliases)
        options = PythonPrivateAccessOptions(
            {
                "tree": self.tree.tree,
                "node_index": self.tree.node_index,
                "container_aliases": container_aliases,
                "container_keys": container_aliases.container_keys,
                "reflection_names": reflection_names,
                "private_vars_mapping": private_mapping,
            }
        )
        options.validate()
        return options

    def _configured_reflection_names(
        self, container_aliases: PythonContainerAliasesContract
    ) -> PythonReflectionNamesContract:
        """Responsibilities: _reflection name configuration_."""
        reflection_names: PythonReflectionNamesContract = PythonBuiltinReflectionNames(
            container_aliases, self.tree.reference_aliases
        )
        reflection_names.configure(
            self.tree.tree, self.tree.node_index.nodes(self.tree.tree)
        )
        return reflection_names

    def _private_mapping(
        self,
        reflection_names: PythonReflectionNamesContract,
        container_aliases: PythonContainerAliasesContract,
    ) -> PythonPrivateVarsMappingContract:
        """Responsibilities: _private variable mapping_."""
        return PythonPrivateVarsMapping(
            reflection_names,
            container_aliases.container_keys.string_value,
        )

    def _private_access_structure(self) -> JsonObject:
        """Responsibilities: _collection private access structure_."""
        started = perf_counter()
        options = self._private_access_options()
        duration = perf_counter() - started
        timings = self.tree.timings_data()
        timings["private-access-options"] = duration * 1000
        private_access = PythonPrivateAccessCollector(options)
        private_members: Any = self._timed(
            "private-members", private_access.member_names
        )
        private_accesses: Any = self._timed(
            "private-accesses", lambda: private_access.accesses(private_members)
        )
        return {"private_accesses": private_accesses}

    def __init__(self, tree: PythonAstContentTreeContract) -> None:
        """Responsibilities: _initialization AST content_."""
        self.tree: PythonAstContentTreeContract = tree
        self.responsibility_target_collector: PythonResponsibilityTargets = (
            PythonResponsibilityTargets(self.tree.tree, self.tree.node_index)
        )
        self.literal_metadata: PythonLiteralMetadata = PythonLiteralMetadata(self.tree)
        self.reference_content: PythonAstReferenceContent = PythonAstReferenceContent(
            self.tree,
            self.literal_metadata,
            self.responsibility_target_collector,
        )

    def structure(self) -> JsonObject:
        """Responsibilities: _collection AST structure_."""
        structure = self._node_structure()
        structure.update(self._private_access_structure())
        structure[PYTHON_PARSE_ISSUES_KEY] = []
        return structure

    def symbols(self) -> JsonObject:
        """Responsibilities: _collection AST symbols_."""
        return {
            "named_symbols": self._timed(
                "named-symbols", lambda: self.tree.symbols.named_symbols()
            ),
            "type_declarations": self._timed(
                "type-declarations", lambda: self.tree.symbols.type_declarations()
            ),
            "module_instances": self._timed(
                "module-instances", lambda: self.tree.symbols.module_instances()
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
        content.update(self.reference_content.collect())
        content.update(self.symbols())
        return content
