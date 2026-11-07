from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from time import perf_counter

from implementation.ast.callables.python_ast_metadata import PythonAstMetadata
from implementation.ast.callables.python_ast_reference_content import (
    PythonAstReferenceContent,
)
from implementation.ast.protocols import (
    PythonAstContentTreeViewContract,
    PythonAstMetadataContract,
    PythonAstReferenceContentContract,
    PythonLiteralMetadataContract,
    PythonResponsibilityTargetsContract,
)
from implementation.ast.python_literal_metadata import PythonLiteralMetadata
from implementation.ast.type_declarations.python_responsibility_targets import (
    PythonResponsibilityTargets,
)
from implementation.protocols import PythonReflectionNamesContract
from implementation.references.decorator_protocols import (
    PythonPrivateVarsMappingContract,
)
from implementation.references.protocols import PythonContainerAliasesContract
from implementation.references.python_private_vars_mapping import (
    PythonPrivateVarsMapping,
)
from implementation.rules.call_analysis.private_access_protocols import (
    PythonPrivateAccessCollectorContract,
)
from implementation.rules.call_analysis.python_private_access_collector import (
    PythonPrivateAccessCollector,
)
from implementation.rules.call_analysis.python_private_access_options import (
    PythonPrivateAccessOptions,
)
from implementation.rules.call_analysis.reflection.python_builtin_reflection_names import (
    PythonBuiltinReflectionNames,
)
from implementation.rules.constants import PYTHON_PARSE_ISSUES_KEY
from implementation.types import JsonObject, JsonValueList


class PythonAstContent:
    """Responsibilities: _AST structure collection_, _reference data assembly_."""

    def _json_records(self, records: list[JsonObject]) -> JsonValueList:
        """Responsibilities: _JSON record array creation_."""
        values: JsonValueList = []
        values.extend(records)
        return values

    @contextmanager
    def _measure(self, stage_name: str) -> Iterator[None]:
        """Responsibilities: _measurement AST stage_."""
        started = perf_counter()
        try:
            yield
        finally:
            timings = self._tree.timings_data()
            timings[stage_name] = (perf_counter() - started) * 1000

    def _node_collection(self) -> JsonObject:
        """Responsibilities: _AST node collection_."""
        with self._measure("class-nodes"):
            classes = self._tree.class_nodes()
        with self._measure("function-nodes"):
            functions = self._tree.analysis_state().callables().function_nodes().source_functions()
        with self._measure("callable-count"):
            callable_count = self._tree.analysis_state().callables().function_nodes().callable_count()
        return {
            "classes": self._json_records(classes),
            "functions": self._json_records(functions),
            "python_callable_count": callable_count,
        }

    def _access_issue_data(self) -> JsonObject:
        """Responsibilities: _attribute access analysis_, _branch duplication analysis_."""
        structure_issues = self._tree.analysis_state().imports().structure_issues()
        with self._measure("attribute-accesses"):
            attribute_accesses = structure_issues.deep_attribute_accesses(self._tree.tree())
        with self._measure("repeated-branches"):
            repeated_branches = structure_issues.repeated_branches(self._tree.tree())
        return {
            "attribute_accesses": self._json_records(attribute_accesses),
            "repeated_branches": self._json_records(repeated_branches),
        }

    def _structure_issue_data(self) -> JsonObject:
        """Responsibilities: _AST structural issue collection_."""
        with self._measure("import-issues"):
            import_issues = self._tree.analysis_state().imports().import_rules().import_issues(self._tree.tree())
        issue_data: JsonObject = {"import_issues": self._json_records(import_issues)}
        issue_data.update(self._access_issue_data())
        return issue_data

    def _node_structure(self) -> JsonObject:
        """Responsibilities: _collection AST node structure_."""
        structure = self._node_collection()
        structure.update(self._structure_issue_data())
        return structure

    def _configured_reflection_names(
        self,
        container_aliases: PythonContainerAliasesContract,
    ) -> PythonReflectionNamesContract:
        """Responsibilities: _reflection name configuration_."""
        reflection_names = PythonBuiltinReflectionNames(
            container_aliases,
            self._tree.analysis_state().imports().reference_aliases(),
        )
        reflection_names.configure(
            self._tree.tree(),
            self._tree.analysis_state().core().source_dependencies().node_index().nodes(self._tree.tree()),
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
            container_aliases.container_keys().string_value,
        )

    def _private_access_collector(self) -> PythonPrivateAccessCollectorContract:
        """Responsibilities: _private access collector setup_."""
        with self._measure("private-access-options"):
            container_aliases = self._tree.analysis_state().core().container_aliases()
            reflection_names = self._configured_reflection_names(container_aliases)
            private_mapping = self._private_mapping(reflection_names, container_aliases)
            options = PythonPrivateAccessOptions(
                tree=self._tree.tree(),
                node_index=self._tree.analysis_state().core().source_dependencies().node_index(),
                container_aliases=container_aliases,
                container_keys=container_aliases.container_keys(),
                reflection_names=reflection_names,
                private_vars_mapping=private_mapping,
            )
        return PythonPrivateAccessCollector(options)

    def _private_access_structure(self) -> JsonObject:
        """Responsibilities: _private access structure collection_."""
        private_access = self._private_access_collector()
        with self._measure("private-members"):
            private_members = private_access.member_names()
        with self._measure("private-accesses"):
            private_accesses = private_access.accesses(private_members)
        return {"private_accesses": self._json_records(private_accesses)}

    def _named_symbol_data(self) -> JsonObject:
        """Responsibilities: _named symbol metadata_."""
        with self._measure("named-symbols"):
            named_symbols = self._tree.analysis_state().callables().symbols().named_symbols()
        with self._measure("type-declarations"):
            type_declarations = self._tree.analysis_state().callables().symbols().type_declarations()
        with self._measure("module-instances"):
            module_instances = self._tree.analysis_state().callables().symbols().module_instances()
        return {
            "named_symbols": self._json_records(named_symbols),
            "type_declarations": self._json_records(type_declarations),
            "module_instances": self._json_records(module_instances),
        }

    def _module_declaration_data(self) -> JsonObject:
        """Responsibilities: _module declaration spans_."""
        with self._measure("module-constant-spans"):
            constant_spans = self._tree.analysis_state().tree_dependencies().module_constants().collect_spans()
        with self._measure("module-type-spans"):
            type_spans = self._tree.analysis_state().tree_dependencies().module_constants().collect_types()
        with self._measure("module-protocol-spans"):
            protocol_spans = self._tree.analysis_state().tree_dependencies().module_constants().collect_protocols()
        return {
            "module_constant_spans": self._json_records(constant_spans),
            "module_type_spans": self._json_records(type_spans),
            "module_protocol_spans": self._json_records(protocol_spans),
        }

    def __init__(self, tree: PythonAstContentTreeViewContract) -> None:
        """Responsibilities: _AST content initialization_."""
        self._tree: PythonAstContentTreeViewContract = tree
        ast_metadata: PythonAstMetadataContract = PythonAstMetadata(tree)
        self._responsibility_target_collector: PythonResponsibilityTargetsContract = PythonResponsibilityTargets(
            self._tree.tree(),
            self._tree.analysis_state().core().source_dependencies().node_index(),
        )
        self._literal_metadata: PythonLiteralMetadataContract = PythonLiteralMetadata(
            self._tree,
        )
        self._reference_content: PythonAstReferenceContentContract = PythonAstReferenceContent(
            self._tree,
            ast_metadata,
            self._literal_metadata,
            self._responsibility_target_collector,
        )

    def structure(self) -> JsonObject:
        """Responsibilities: _AST structure collection_."""
        structure = self._node_structure()
        structure.update(self._private_access_structure())
        structure[PYTHON_PARSE_ISSUES_KEY] = []
        return structure

    def symbols(self) -> JsonObject:
        """Responsibilities: _AST symbol collection_."""
        symbols = self._named_symbol_data()
        symbols.update(self._module_declaration_data())
        return symbols

    def collect(self) -> JsonObject:
        """Responsibilities: _combination AST content_."""
        content = self.structure()
        content.update(self._reference_content.collect())
        content.update(self.symbols())
        return content
