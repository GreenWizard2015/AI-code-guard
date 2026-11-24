from __future__ import annotations

import os

from implementation.ast.python_ast_tree import PythonAstTree
from implementation.types import JsonObject


class PythonAstTreeProcessProbe(PythonAstTree):
    """Responsibilities: _AST execution identity_, _analysis issue evidence_."""

    def _analysis_issue_count(self) -> int:
        """Responsibilities: _Python analysis issues_."""
        return len(self.coding_issues())

    def _analysis_process_evidence(self) -> JsonObject:
        """Responsibilities: _analysis process evidence_."""
        return {
            "analysis_process_id": os.getpid(),
            "analysis_issue_count": self._analysis_issue_count(),
        }

    def ast(self) -> JsonObject:
        """Responsibilities: _AST analysis evidence_."""
        result = super().ast()
        result.update(self._analysis_process_evidence())
        return result
