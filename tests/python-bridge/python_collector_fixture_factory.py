from __future__ import annotations

import ast

from implementation.ast.callables.coding_issue_aliases import (
    PythonCodingIssueAliases,
    PythonCodingIssueContainerAliases,
    PythonCodingIssueValueAliases,
)
from implementation.ast.callables.coding_issue_options import (
    PythonCodingIssueCollectorOptions,
    PythonCodingIssueRules,
    PythonCodingIssueSource,
)
from implementation.ast.callables.scoped_type_aliases import PythonScopedTypeAliases
from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.imports.source_segments import SourceSegments
from implementation.references.aliases.python_container_assembly import (
    PythonContainerAssembly,
)
from implementation.references.aliases.python_reference_aliases import (
    PythonReferenceAliases,
    PythonReferenceAliasState,
)
from implementation.references.protocols import PythonContainerAliasesContract
from implementation.rules.control_flow.python_terminal_branch_rules import (
    PythonTerminalBranchRules,
)


class PythonCollectorFixtureOptionsFactory:
    """Responsibilities: _collector source preparation_, _analysis dependency assembly_."""

    """Responsibilities: _coding collector fixture assembly_."""

    def _assemblies(self) -> list[PythonContainerAssembly]:
        """Responsibilities: _container assembly creation_."""
        index = PythonAstNodeIndex()
        return [PythonContainerAssembly(index) for _ in range(9)]

    def _container_aliases(
        self,
        assemblies: list[PythonContainerAssembly],
    ) -> list[PythonContainerAliasesContract]:
        """Responsibilities: _container alias collection_."""
        return [assembly.container_aliases() for assembly in assemblies]

    def _source(
        self,
        tree: ast.AST,
        source: str,
        index: PythonAstNodeIndex,
    ) -> PythonCodingIssueSource:
        """Responsibilities: _coding source assembly_."""
        source_segments = SourceSegments(source)
        return PythonCodingIssueSource(
            tree,
            source,
            source_segments,
            index,
        )

    def _aliases(
        self,
        aliases: list[PythonContainerAliasesContract],
        value_assembly: PythonContainerAssembly,
        tree: ast.AST,
        index: PythonAstNodeIndex,
    ) -> PythonCodingIssueAliases:
        """Responsibilities: _coding alias assembly_."""
        return PythonCodingIssueAliases(
            PythonCodingIssueContainerAliases(*aliases),
            PythonCodingIssueValueAliases(
                value_assembly.container_values(),
                value_assembly.container_keys(),
                PythonScopedTypeAliases(tree, index),
                PythonReferenceAliases(PythonReferenceAliasState()),
            ),
        )

    def create(self, tree: ast.AST, source: str) -> PythonCodingIssueCollectorOptions:
        """Responsibilities: _coding collector fixture creation_."""
        assemblies = self._assemblies()
        index = PythonAstNodeIndex()
        return PythonCodingIssueCollectorOptions(
            self._source(tree, source, index),
            self._aliases(
                self._container_aliases(assemblies),
                assemblies[0],
                tree,
                index,
            ),
            PythonCodingIssueRules(PythonTerminalBranchRules()),
        )
