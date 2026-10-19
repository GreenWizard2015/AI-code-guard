import ast
import unittest

from implementation.ast.python_ast_tree import PythonAstTree
from implementation.ast.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.type_declarations.annotation_names import AnnotationNames
from implementation.references.aliases.python_container_assembly import PythonContainerAssembly
from implementation.references.aliases.python_reference_aliases import PythonReferenceAliases
from implementation.rules.python_syntax.decorators.python_decorator_alias_state import PythonDecoratorAliasState
from implementation.rules.python_syntax.decorators.python_decorator_rules import PythonDecoratorRules
from implementation.rules.python_syntax.python_type_factory_names import PythonTypeFactoryNames
from implementation.rules.type_rules.python_typing_aliases import PythonTypingAliases
from implementation.rules.type_rules.type_rules import TypeRules
from implementation.rules.union.union_annotation_rules import UnionAnnotationRules
from implementation.rules.union.union_rules import UnionRules
from implementation.rules.union.union_rules_options import UnionRulesOptions
from implementation.types import JsonObject
from tests.python.constants import OPTIONAL_ALIAS_SOURCE, TYPE_SOURCE


class PythonBridgeTypeRuleTest(unittest.TestCase):
    """Responsibilities: _composite type diagnostics_, _type alias resolution_."""

    """Responsibilities: _Python AST outputs verification_."""

    container_assembly: PythonContainerAssembly

    def __init__(self, methodName: str = "runTest") -> None:
        """Responsibilities: _type rule fixture initialization_."""
        super().__init__(methodName)
        self.container_assembly: PythonContainerAssembly = PythonContainerAssembly(PythonAstNodeIndex())

    def _python_ast_node_index(self) -> PythonAstNodeIndex:
        """Responsibilities: _AST index creation_."""
        return PythonAstNodeIndex()

    def _union_rules(self, tree: ast.AST) -> UnionRules:
        """Responsibilities: _union diagnostics fixture setup_."""
        container_aliases = self.container_assembly.container_aliases()
        python_typing_aliases = PythonTypingAliases(PythonReferenceAliases())
        annotation_rules = UnionAnnotationRules(
            3, self._python_ast_node_index(), python_typing_aliases, container_aliases
        )
        options = UnionRulesOptions()
        options.tree_value = tree
        options.node_index_value = self._python_ast_node_index()
        options.container_aliases_value = container_aliases
        options.typing_aliases_value = python_typing_aliases
        options.annotation_rules_value = annotation_rules
        return UnionRules(options)

    def test_union_issues(self) -> None:
        """Responsibilities: _union diagnostics verification_."""
        tree = ast.parse(TYPE_SOURCE)
        container_aliases = self.container_assembly.container_aliases()
        references = PythonReferenceAliases()
        decorator_aliases = PythonDecoratorAliasState(container_aliases, references)
        type_rules = TypeRules(
            tree,
            PythonDecoratorRules(
                container_aliases,
                references,
                decorator_aliases,
                decorator_aliases.assigned_descriptors,
            ),
            PythonTypeFactoryNames(self.container_assembly.container_aliases(), PythonReferenceAliases()),
        )
        unions = self._union_rules(tree)
        generic: list[JsonObject] = [
            issue for node in ast.walk(tree) for issue in type_rules.collect_generic_types(node)
        ]
        union: list[JsonObject] = [issue for node in ast.walk(tree) for issue in unions.collect_union_issues(node)]
        self.assertTrue(generic)
        self.assertIn("nullable-domain-type", {issue["kind"] for issue in union})

    def test_optional_assignment_alias(self) -> None:
        """Responsibilities: _optional assignment aliases verification_."""
        parser = PythonAstTree(OPTIONAL_ALIAS_SOURCE)
        issues = parser.coding_issues()
        self.assertEqual(
            len([issue for issue in issues if issue["kind"] == "nullable-domain-type"]),
            6,
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
        resolver = AnnotationNames()
        aliases = {"Alias": "Payload"}
        transparent = {"list", "Optional", "Union"}
        self.assertEqual(
            {
                "plain": resolver.annotation_name(ast.parse("Alias", mode="eval").body, aliases, transparent),
                "generic": resolver.annotation_name(
                    ast.parse("list[Alias] | None", mode="eval").body, aliases, transparent
                ),
                "quoted": resolver.annotation_name(ast.parse('"Alias"', mode="eval").body, aliases, transparent),
                "constructor": resolver.resolve_constructor(ast.parse("Alias()", mode="eval").body, {"Alias"}, aliases),
            },
            {"plain": "Payload", "generic": "Payload", "quoted": "Payload", "constructor": "Payload"},
        )
