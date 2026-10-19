#!/usr/bin/env python3
"""Combine linter performance snapshots into one Markdown report."""

from __future__ import annotations

from performance.performance_cli import PerformanceCli


def main() -> None:
    """Responsibilities: _performance CLI execution_."""
    cli = PerformanceCli()
    cli.run()


if __name__ == "__main__":
    main()
