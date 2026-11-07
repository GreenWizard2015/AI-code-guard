from __future__ import annotations

import ast
import unittest

from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.rules.finite_variants.finite_variant_mapping import FiniteVariantMapping
from implementation.rules.finite_variants.python_finite_variant_index import (
    PythonFiniteVariantIndex,
)


class PythonFiniteVariantTest(unittest.TestCase):
    """Responsibilities: _finite variant snapshots_, _member collection ownership_."""

    def test_returns_a_copy_of_members_and_its_discriminant(self) -> None:
        """Responsibilities: _variant snapshot result verification_."""
        tree = ast.parse("import enum\nclass Status(enum.Enum):\n    READY = 1\n    FAILED = 2\n")
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)
        index = PythonFiniteVariantIndex(node_index)
        index.add_source(tree)
        variant = index.variant("Status")

        members = variant.members()
        members.clear()

        self.assertEqual(
            {
                "members": variant.members(),
                "discriminant": variant.discriminant(),
                "supports": variant.supports(),
            },
            {"members": {"READY", "FAILED"}, "discriminant": "", "supports": True},
        )

    def test_unknown_variant_has_no_members_or_discriminant(self) -> None:
        """Responsibilities: _unknown variant result verification_."""
        index = PythonFiniteVariantIndex(PythonAstNodeIndex())
        variant = index.variant("Missing")

        self.assertEqual(
            {
                "members": variant.members(),
                "discriminant": variant.discriminant(),
                "supports": variant.supports(),
            },
            {"members": set(), "discriminant": "", "supports": False},
        )

    def test_incomplete_mapping_reports_missing_variant(self) -> None:
        """Responsibilities: _incomplete variant mapping diagnostic_."""
        tree = ast.parse(
            "from enum import Enum\n"
            "class SourceState(Enum):\n"
            "    READY = 'ready'\n"
            "    FAILED = 'failed'\n"
            "class TargetState(Enum):\n"
            "    AVAILABLE = 'available'\n"
            "    ERROR = 'error'\n"
            "def map_state(value: SourceState) -> TargetState:\n"
            "    match value:\n"
            "        case SourceState.READY:\n"
            "            return TargetState.AVAILABLE\n"
            "        case _:\n"
            "            return TargetState.ERROR\n",
        )
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)
        analysis = FiniteVariantMapping(tree, node_index)

        analysis.prepare()
        issues = analysis.issues()

        self.assertEqual(
            issues,
            [{"line": 8, "kind": "finite-variant-mapping-is-incomplete"}],
        )
