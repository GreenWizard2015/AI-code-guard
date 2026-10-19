from __future__ import annotations

from implementation.ast.callables.callable_statements import CallableStatements
from implementation.protocols import (
    PythonCodingIssueComponentContextContract,
    PythonControlFlowIssuesContract,
    PythonOperatorPrecedenceContract,
)
from implementation.rules.control_flow.control_flow_issues import (
    PythonControlFlowIssues,
    PythonControlFlowOptions,
)
from implementation.rules.control_flow.python_operator_precedence import (
    PythonOperatorPrecedence,
)


class PythonCodingIssueFlowState:
    """Responsibilities: _control-flow analysis_, _operator precedence analysis_."""

    _control_flow: PythonControlFlowIssuesContract
    _precedence: PythonOperatorPrecedenceContract

    def __init__(self, context: PythonCodingIssueComponentContextContract) -> None:
        """Responsibilities: _flow state initialization_."""
        statements = CallableStatements()
        self._control_flow: PythonControlFlowIssuesContract = PythonControlFlowIssues(
            PythonControlFlowOptions(
                context.tree,
                context.source_text.splitlines(),
                statements.assignment_value_ids(context.tree, context.node_index),
                context.node_index,
                context.python_predicate_condition,
                context.terminal_branches,
                context.source_segments,
            )
        )
        self._precedence: PythonOperatorPrecedenceContract = PythonOperatorPrecedence(
            context.tree, context.node_index, context.expression_boundary
        )

    def control_flow(self) -> PythonControlFlowIssuesContract:
        """Responsibilities: _control-flow access_."""
        return self._control_flow

    def precedence(self) -> PythonOperatorPrecedenceContract:
        """Responsibilities: _precedence access_."""
        return self._precedence
