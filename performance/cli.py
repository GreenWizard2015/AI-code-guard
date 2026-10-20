#!/usr/bin/env python3
"""Combine linter performance snapshots into one Markdown report."""

from __future__ import annotations

import argparse
from pathlib import Path

from performance.constants import NO_PERFORMANCE_SNAPSHOTS_MESSAGE, TEXT_ENCODING
from performance.performance_report import PerformanceReport
from performance.path_performance_snapshot_io import PathPerformanceSnapshotIO


if __name__ == "__main__":
    argument_parser = argparse.ArgumentParser(
        description="Combine linter performance snapshots into one Markdown report."
    )
    argument_parser.add_argument("snapshots", nargs="+", help="performance.md files or directories")
    argument_parser.add_argument("-o", "--output", type=Path, help="write Markdown to this file")
    options = argument_parser.parse_args()
    report = PerformanceReport(options.snapshots, PathPerformanceSnapshotIO())
    if not report.snapshots_available():
        raise SystemExit(NO_PERFORMANCE_SNAPSHOTS_MESSAGE)
    try:
        output = report.markdown()
    except ValueError as error:
        raise SystemExit(str(error)) from error
    if options.output is None:
        print(output, end="")
    if options.output is not None:
        options.output.write_text(output, encoding=TEXT_ENCODING)
