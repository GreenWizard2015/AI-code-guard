import ast
import unittest

from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.python_ast_tree import PythonAstTree
from implementation.ast.type_declarations.annotation_names import AnnotationNames
from implementation.rules.union.python_conditional_type_alias_analysis import (
    PythonConditionalTypeAliasAnalysis,
)
from implementation.rules.union.python_union_declaration_annotations import (
    PythonUnionDeclarationAnnotations,
)

from tests.python.constants import (
    BUILTIN_DECORATOR_ALIAS_SOURCE,
    OPTIONAL_ALIAS_SOURCE,
    TYPE_SOURCE,
)


class PythonBridgeTypeRuleTest(unittest.TestCase):
    """Responsibilities: _composite type diagnostics_, _type alias resolution_."""

    """Responsibilities: _Python AST outputs verification_."""

    def _python_ast_node_index(self) -> PythonAstNodeIndex:
        """Responsibilities: _AST index creation_."""
        return PythonAstNodeIndex()

    def test_union_issues(self) -> None:
        """Responsibilities: _union diagnostics verification_."""
        parser = PythonAstTree(TYPE_SOURCE)
        issues = parser.coding_issues()
        kinds = {issue["kind"] for issue in issues}
        self.assertIn("inline-generic-type", kinds)
        self.assertIn("nullable-domain-type", kinds)

    def test_optional_assignment_alias(self) -> None:
        """Responsibilities: _optional assignment aliases verification_."""
        parser = PythonAstTree(OPTIONAL_ALIAS_SOURCE)
        issues = parser.coding_issues()
        self.assertEqual(
            len([issue for issue in issues if issue["kind"] == "nullable-domain-type"]),
            6,
        )

    def test_optional_alias_resolution(self) -> None:
        """Responsibilities: _module alias state_."""
        source = """
from typing import Optional as Maybe

class Unrelated:
    pass

"module expression"
Choice = Maybe

def read(value: Choice[str]) -> Choice[str]:
    return value
"""
        parser = PythonAstTree(source)
        issues = parser.coding_issues()
        nullable = [issue for issue in issues if issue["kind"] == "nullable-domain-type"]

        self.assertEqual(len(nullable), 2)

    def test_union_alias_inputs_skip_unrelated_imports(self) -> None:
        """Responsibilities: _union alias input selection_."""
        source = (
            "import os\n"
            "import builtins as native\n"
            "from pathlib import Path\n"
            "from typing import Optional as Maybe\n"
            "VALUE = 1\n"
        )
        tree = ast.parse(source)
        index = self._python_ast_node_index()
        declarations = PythonUnionDeclarationAnnotations(
            tree,
            index,
            PythonConditionalTypeAliasAnalysis(index),
        )

        self.assertEqual(
            [ast.unparse(statement) for statement in declarations.module_alias_statements()],
            ["import builtins as native", "from typing import Optional as Maybe", "VALUE = 1"],
        )

    def test_nested_conditional_type_alias(self) -> None:
        """Responsibilities: _conditional type alias traversal_."""
        tree = ast.parse(
            "if TYPE_CHECKING:\n"
            "    def build():\n"
            "        Alias = Left | Right\n"
            "else:\n"
            "    Alias = object\n"
            "if FEATURE_ENABLED:\n"
            "    value = 1\n",
        )
        index = self._python_ast_node_index()
        analysis = PythonConditionalTypeAliasAnalysis(index)

        self.assertEqual(
            [issue["kind"] for node in tree.body for issue in analysis.issue(node)],
            ["python-conditional-type-alias"],
        )

    def test_collects_composite_union_issues(self) -> None:
        """Responsibilities: _composite union diagnostics verification_."""
        source = "Value = A | B\ndef read(value: A | B) -> A | B:\n    return value\n"
        parser = PythonAstTree(source)
        issues = parser.coding_issues()
        self.assertEqual(
            len([issue for issue in issues if issue["kind"] == "composite-state-type"]),
            3,
        )

    def test_collects_composite_intersection_issues(self) -> None:
        """Responsibilities: _composite intersection diagnostics verification_."""
        source = "Value = A & B\ndef read(value: A & B) -> A & B:\n    return value\n"
        parser = PythonAstTree(source)
        issues = parser.coding_issues()
        self.assertEqual(
            len([issue for issue in issues if issue["kind"] == "composite-state-type"]),
            3,
        )

    def test_annotation_names(self) -> None:
        """Responsibilities: _annotation aliases verification_."""
        resolver = AnnotationNames(PythonAstNodeIndex())
        aliases = {"Alias": "Payload"}
        transparent = {"list", "Optional", "Union"}
        self.assertEqual(
            {
                "plain": resolver.annotation_name(ast.parse("Alias", mode="eval").body, aliases, transparent),
                "generic": resolver.annotation_name(
                    ast.parse("list[Alias] | None", mode="eval").body,
                    aliases,
                    transparent,
                ),
                "quoted": resolver.annotation_name(ast.parse('"Alias"', mode="eval").body, aliases, transparent),
                "constructor": resolver.resolve_constructor(
                    ast.parse("Alias()", mode="eval").body,
                    {"Alias"},
                    aliases,
                ),
            },
            {"plain": "Payload", "generic": "Payload", "quoted": "Payload", "constructor": "Payload"},
        )

    def test_annotation_name_resolution_context_is_per_call(self) -> None:
        """Responsibilities: _annotation context isolation verification_."""
        resolver = AnnotationNames(PythonAstNodeIndex())
        annotation = ast.parse("list[Alias]", mode="eval").body
        names = [
            resolver.annotation_name(annotation, {"Alias": "First"}, {"list"}),
            resolver.annotation_name(annotation, {"Alias": "Second"}, {"list"}),
            resolver.annotation_name(annotation, {"Alias": "Ignored"}, set()),
        ]
        self.assertEqual(names, ["First", "Second", ""])

    def test_recognizes_static_method_aliases(self) -> None:
        """Responsibilities: _static decorator classification_."""
        tree = PythonAstTree(BUILTIN_DECORATOR_ALIAS_SOURCE)
        kinds = [issue["kind"] for issue in tree.coding_issues()]
        self.assertIn("python-static-method", kinds)

    def test_recognizes_class_method_aliases(self) -> None:
        """Responsibilities: _class decorator classification_."""
        tree = PythonAstTree(BUILTIN_DECORATOR_ALIAS_SOURCE)
        kinds = [issue["kind"] for issue in tree.coding_issues()]
        self.assertEqual(kinds.count("python-class-method"), 3)
