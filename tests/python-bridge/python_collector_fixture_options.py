from __future__ import annotations

from implementation.coding_issue_options import (
    PythonCodingIssueCollectorOptions,
)


class PythonCollectorFixtureOptions:
    """Responsibilities: _collector source inputs_, _collector dependency bundle_."""

    """Responsibilities: _coding collector fixture dependencies_."""

    options: PythonCodingIssueCollectorOptions

    def __init__(self, options: PythonCodingIssueCollectorOptions) -> None:
        """Responsibilities: _fixture option assignment_."""
        self.options: PythonCodingIssueCollectorOptions = options
