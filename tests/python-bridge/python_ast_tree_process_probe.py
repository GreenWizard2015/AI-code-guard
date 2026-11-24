from __future__ import annotations

import os

from implementation.ast.python_ast_tree import PythonAstTree
from implementation.types import JsonObject


class PythonAstTreeProcessProbe(PythonAstTree):
    """Responsibilities: _AST rule execution_, _process identity evidence_."""

    def _record_analysis_process(self, result: JsonObject) -> None:
        """Responsibilities: _completed analysis evidence_, _process identity_."""
        coding_issues = result.get("coding_issues")
        if type(coding_issues) is not list:
            return
        issue_count = len(coding_issues)
        process_id = os.getpid()
        result.update({"analysis_process_id": process_id, "analysis_issue_count": issue_count})

    def ast(self) -> JsonObject:
        """Responsibilities: _Python rule execution_."""
        result = super().ast()
        self._record_analysis_process(result)
        return result
