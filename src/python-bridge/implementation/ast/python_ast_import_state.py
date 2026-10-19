from __future__ import annotations

import ast
from functools import cached_property

from implementation.ast.imports.import_rules_factory import PythonImportConfiguration
from implementation.ast.protocols import PythonAstImportStateOptionsContract
from implementation.ast.imports.python_sys_path_rules import PythonSysPathRules
from implementation.ast.type_declarations.annotation_names import AnnotationNames
from implementation.protocols import (
    PythonAstNodeIndexContract,
    PythonImportRulesContract,
    PythonReferenceCollectorContract,
    PythonStructureIssuesContract,
)
from implementation.references.aliases.protocols import (
    PythonContainerAliasesContract,
    PythonReferenceAliasesContract,
)
from implementation.references.call_returns import CallReturns
from implementation.references.python_call_return_state import PythonCallReturnState
from implementation.references.python_reference_collector import (
    PythonReferenceCollector,
)
from implementation.rules.import_rules import ImportRules
from implementation.rules.constants import PYTHON_DYNAMIC_IMPORT_FUNCTION
from implementation.rules.python_syntax.dynamic_import_names import (
    PythonDynamicImportNames,
    PythonDynamicImportNamesOptions,
)
from implementation.rules.python_syntax.protocols import (
    PythonDynamicImportNamesContract,
)
from implementation.rules.python_syntax.python_dynamic_import_references import (
    PythonDynamicImportReferences,
)


class PythonAstImportState:
    """Responsibilities: _import state_, _reference state_."""

    _structure_issues: PythonStructureIssuesContract
    _reference_aliases: PythonReferenceAliasesContract
    _tree: ast.Module
    _node_index: PythonAstNodeIndexContract
    _container_aliases: PythonContainerAliasesContract

    def _dynamic_names(self) -> PythonDynamicImportNamesContract:
        """Responsibilities: _dynamic import names_."""
        module_aliases: dict[str, str] = {}
        builtin_aliases: set[str] = set()
        function_aliases = {
            PYTHON_DYNAMIC_IMPORT_FUNCTION: PYTHON_DYNAMIC_IMPORT_FUNCTION,
            "getattr": "getattr",
        }
        dynamic_references = PythonDynamicImportReferences(
            module_aliases,
            builtin_aliases,
            function_aliases,
            self._container_aliases.container_values,
        )
        return PythonDynamicImportNames(
            PythonDynamicImportNamesOptions(
                self._container_aliases,
                dynamic_references,
                module_aliases,
                builtin_aliases,
                function_aliases,
            )
        )

    @cached_property
    def _import_rules_state(self) -> PythonImportRulesContract:
        """Responsibilities: _import rule state_."""
        path_state = PythonSysPathRules(self._container_aliases, self._node_index)
        dynamic_names = self._dynamic_names()
        configuration = PythonImportConfiguration(
            self._container_aliases,
            dynamic_names,
            path_state,
        )
        return ImportRules(
            configuration.container_aliases,
            configuration.dynamic_names,
            configuration.path_rules,
            self._node_index,
        )

    @cached_property
    def _reference_state(self) -> PythonReferenceCollectorContract:
        """Responsibilities: _reference collector state_."""
        state = PythonCallReturnState()
        return PythonReferenceCollector(
            self._tree,
            CallReturns(AnnotationNames(), state),
            self._node_index,
            state,
        )

    def __init__(self, options: PythonAstImportStateOptionsContract) -> None:
        """Responsibilities: _import state initialization_."""
        self._tree: ast.Module = options.source_tree()
        self._node_index: PythonAstNodeIndexContract = options.source_node_index()
        self._container_aliases: PythonContainerAliasesContract = (
            options.source_container_aliases()
        )
        self._structure_issues: PythonStructureIssuesContract = (
            options.source_structure_issues()
        )
        self._reference_aliases: PythonReferenceAliasesContract = (
            options.source_reference_aliases()
        )

    def import_rules(self) -> PythonImportRulesContract:
        """Responsibilities: _import rule access_."""
        return self._import_rules_state

    def structure_issues(self) -> PythonStructureIssuesContract:
        """Responsibilities: _structure issue access_."""
        return self._structure_issues

    def reference_aliases(self) -> PythonReferenceAliasesContract:
        """Responsibilities: _reference alias access_."""
        return self._reference_aliases

    def references(self) -> PythonReferenceCollectorContract:
        """Responsibilities: _reference collection access_."""
        return self._reference_state
