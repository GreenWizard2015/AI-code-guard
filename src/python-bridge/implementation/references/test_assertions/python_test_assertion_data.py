from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.ast.protocols import (
    PythonCallableStatementsContract,
    PythonTestAssertionAliasesContract,
)
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonContainerKeysContract,
)
from implementation.references.aliases.python_reference_aliases import (
    PythonReferenceAliases,
)
from implementation.references.test_assertions.assertion_aliases import (
    PythonTestAssertionAliases,
    PythonTestAssertionAliasesOptions,
)
from implementation.references.test_assertions.python_callable_test_assertions import (
    PythonCallableTestAssertions,
)
from implementation.types import JsonObject


class PythonTestAssertionData:
    """Responsibilities: _assertion metadata collection_, _assertion alias construction_."""

    def __init__(
        self,
        node_index: PythonAstNodeIndexContract,
        container_aliases: PythonContainerAliasesContract,
    ) -> None:
        """Responsibilities: _initialization test assertion dependencies_."""
        self.node_index: PythonAstNodeIndexContract = node_index
        self.container_aliases: PythonContainerAliasesContract = container_aliases
        self.container_keys: PythonContainerKeysContract = (
            container_aliases.container_keys
        )
        self.assignment_aliases: PythonReferenceAliases = PythonReferenceAliases()

    def collect(
        self, node: ast.AST, callable_statements: PythonCallableStatementsContract
    ) -> JsonObject:
        """Responsibilities: _collection assertion test-ending metadata_."""
        assertion_aliases = self.assertion_aliases(node)
        assertions = PythonCallableTestAssertions(
            node, self.node_index, assertion_aliases
        )
        return {
            "has_unittest_assertion": assertions.unittest_assertion_present(),
            "unittest_assertion_alias": assertions.assertion_aliases.assertion_alias_present(),
            "unittest_exception_only": assertions.exception_only_assertion(),
            "test_exception_bypass": assertions.exception_bypass(),
            "unittest_ending_valid": assertions.valid_assertion_ending(
                callable_statements
            ),
            "unittest_assertion_count": assertions.assertion_count(callable_statements),
        }

    def assertion_aliases(self, node: ast.AST) -> PythonTestAssertionAliasesContract:
        """Responsibilities: _assertion alias resolution_."""
        return PythonTestAssertionAliases(
            PythonTestAssertionAliasesOptions(
                node,
                self.node_index,
                self.container_aliases,
                self.container_keys,
                self.assignment_aliases,
            )
        )
