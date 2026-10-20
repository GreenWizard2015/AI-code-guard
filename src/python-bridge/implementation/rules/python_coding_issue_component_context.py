from __future__ import annotations

import ast
from typing import cast

from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonSourceSegmentsContract,
)
from implementation.rules.protocols import PythonCodingIssueOptionsContract
from implementation.rules.protocols import (
    PythonExpressionBoundaryContract,
    PythonPredicateConditionContract,
    PythonTerminalBranchContract,
)
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonContainerKeysContract,
    PythonContainerValuesContract,
    PythonReferenceAliasesContract,
    PythonScopedTypeAliasesContract,
)
from implementation.rules.constants import (
    PYTHON_CONTAINER_ALIASES_KEY,
    PYTHON_CONTAINER_KEYS_KEY,
    PYTHON_NODE_INDEX_KEY,
    PYTHON_REFERENCE_ALIASES_KEY,
)


class PythonCodingIssueComponentContext:
    """Responsibilities: _rule input storage_, _analysis dependency ownership_."""

    tree: ast.AST
    node_index: PythonAstNodeIndexContract
    source_text: str
    source_segments: PythonSourceSegmentsContract
    expression_boundary: PythonExpressionBoundaryContract
    container_aliases: PythonContainerAliasesContract
    union_container_aliases: PythonContainerAliasesContract
    field_container_aliases: PythonContainerAliasesContract
    simple_container_aliases: PythonContainerAliasesContract
    subtest_container_aliases: PythonContainerAliasesContract
    factory_container_aliases: PythonContainerAliasesContract
    exception_container_aliases: PythonContainerAliasesContract
    dynamic_container_aliases: PythonContainerAliasesContract
    decorator_container_aliases: PythonContainerAliasesContract
    container_values: PythonContainerValuesContract
    container_keys: PythonContainerKeysContract
    type_aliases: PythonScopedTypeAliasesContract
    reference_aliases: PythonReferenceAliasesContract
    terminal_branches: PythonTerminalBranchContract
    python_predicate_condition: PythonPredicateConditionContract

    def __init__(self, options: PythonCodingIssueOptionsContract) -> None:
        """Responsibilities: _construction input extraction_."""
        source = options.source_data()
        aliases = options.alias_data()
        rules = options.rule_data()
        self.tree: ast.AST = cast(ast.AST, source["tree"])
        self.node_index: PythonAstNodeIndexContract = cast(
            PythonAstNodeIndexContract, source[PYTHON_NODE_INDEX_KEY]
        )
        self.source_text: str = cast(str, source["source"])
        self.source_segments: PythonSourceSegmentsContract = cast(
            PythonSourceSegmentsContract, source["source_segments"]
        )
        self.expression_boundary: PythonExpressionBoundaryContract = cast(
            PythonExpressionBoundaryContract, source["expression_boundary"]
        )
        self.container_aliases: PythonContainerAliasesContract = cast(
            PythonContainerAliasesContract, aliases[PYTHON_CONTAINER_ALIASES_KEY]
        )
        self.union_container_aliases: PythonContainerAliasesContract = cast(
            PythonContainerAliasesContract, aliases["union_container_aliases"]
        )
        self.field_container_aliases: PythonContainerAliasesContract = cast(
            PythonContainerAliasesContract, aliases["field_container_aliases"]
        )
        self.simple_container_aliases: PythonContainerAliasesContract = cast(
            PythonContainerAliasesContract, aliases["simple_container_aliases"]
        )
        self.subtest_container_aliases: PythonContainerAliasesContract = cast(
            PythonContainerAliasesContract, aliases["subtest_container_aliases"]
        )
        self.factory_container_aliases: PythonContainerAliasesContract = cast(
            PythonContainerAliasesContract, aliases["factory_container_aliases"]
        )
        self.exception_container_aliases: PythonContainerAliasesContract = cast(
            PythonContainerAliasesContract, aliases["exception_container_aliases"]
        )
        self.dynamic_container_aliases: PythonContainerAliasesContract = cast(
            PythonContainerAliasesContract, aliases["dynamic_container_aliases"]
        )
        self.decorator_container_aliases: PythonContainerAliasesContract = cast(
            PythonContainerAliasesContract, aliases["decorator_container_aliases"]
        )
        self.container_values: PythonContainerValuesContract = cast(
            PythonContainerValuesContract, aliases["container_values"]
        )
        self.container_keys: PythonContainerKeysContract = cast(
            PythonContainerKeysContract, aliases[PYTHON_CONTAINER_KEYS_KEY]
        )
        self.type_aliases: PythonScopedTypeAliasesContract = cast(
            PythonScopedTypeAliasesContract, aliases["type_aliases"]
        )
        self.reference_aliases: PythonReferenceAliasesContract = cast(
            PythonReferenceAliasesContract, aliases[PYTHON_REFERENCE_ALIASES_KEY]
        )
        self.terminal_branches: PythonTerminalBranchContract = cast(
            PythonTerminalBranchContract, rules["terminal_branches"]
        )
        self.python_predicate_condition: PythonPredicateConditionContract = cast(
            PythonPredicateConditionContract, rules["python_predicate_condition"]
        )
