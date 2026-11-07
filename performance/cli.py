#!/usr/bin/env python3
"""Combine linter performance snapshots into one Markdown report."""

from __future__ import annotations

import argparse
import sys
from io import StringIO
from pathlib import Path

from performance.constants import TEXT_ENCODING
from performance.path_performance_snapshot_io import PathPerformanceSnapshotIO
from performance.performance_report import PerformanceReport

if __name__ == "__main__":
    argument_parser = argparse.ArgumentParser(
        description="Combine linter performance snapshots into one Markdown report.",
    )
    argument_parser.add_argument("snapshots", nargs="+", help="performance.md files or directories")
    argument_parser.add_argument("-o", "--output", type=Path, help="write Markdown to this file")
    options = argument_parser.parse_args()
    report = PerformanceReport(options.snapshots, PathPerformanceSnapshotIO())
    output = StringIO()
    status = report.write_report(output, sys.stderr)
    if status != 0:
        raise SystemExit(status)
    if options.output is None:
        sys.stdout.write(output.getvalue())
    if options.output is not None:
        options.output.write_text(output.getvalue(), encoding=TEXT_ENCODING)
