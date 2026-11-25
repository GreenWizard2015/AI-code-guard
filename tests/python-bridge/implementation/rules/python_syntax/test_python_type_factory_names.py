from __future__ import annotations

import ast
import unittest

from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.references.aliases.python_container_assembly import (
    PythonContainerAssembly,
)
from implementation.references.aliases.python_reference_aliases import PythonReferenceAliases
from implementation.references.data_models import PythonReferenceAliasState
from implementation.rules.python_syntax.decorators.python_decorator_alias_state import (
    PythonDecoratorAliasState,
)
from implementation.rules.python_syntax.decorators.python_decorator_rules import (
    PythonDecoratorRules,
)
from implementation.rules.python_syntax.python_tuple_type_names import (
    PythonTupleTypeNames,
)
from implementation.rules.python_syntax.python_type_factory_names import (
    PythonTypeFactoryNames,
)
from implementation.rules.type_rules.type_rules import TypeRules
from implementation.rules.type_rules.type_rules_options import TypeRulesOptions
from python_reference_test_support import PythonReferenceTestSupport

from tests.python.constants import TYPE_FACTORY_ALIAS_SOURCE


class PythonTypeFactoryAliasesTest(unittest.TestCase):
    """Responsibilities: _type factory import aliases_, _assignment alias resolution_."""

    """Responsibilities: _type factory aliases_."""

    def _source(self) -> str:
        """Responsibilities: _type factory source_."""
        return (
            TYPE_FACTORY_ALIAS_SOURCE
            + """
from typing import NamedTuple
def publish(record_type):
    return record_type
def build_record():
    return NamedTuple("Record", [])
def build_published_record():
    return publish(NamedTuple("PublishedRecord", []))
register(NamedTuple("RegisteredRecord", []))
"""
        )

    def _type_rules(
        self,
        tree: ast.Module,
        node_index: PythonAstNodeIndex,
    ) -> TypeRules:
        """Responsibilities: _type factory fixture setup_."""
        node_index.nodes(tree)
        container_assembly = PythonContainerAssembly(node_index)
        aliases = container_assembly.container_aliases()
        references = PythonReferenceAliases(PythonReferenceAliasState())
        decorator_aliases = PythonDecoratorAliasState(aliases, references, node_index)
        factory_names = PythonTypeFactoryNames(aliases, references)
        factory_names.configure(tree)
        type_rules = TypeRules(
            TypeRulesOptions(
                tree=tree,
                node_index=node_index,
                decorator_rules=PythonDecoratorRules(
                    aliases.container_values(),
                    decorator_aliases,
                    decorator_aliases.assigned_descriptors(),
                ),
                decorator_aliases=decorator_aliases,
                type_factory_names=factory_names,
                tuple_type_names=PythonTupleTypeNames(aliases, references),
            ),
        )
        type_rules.prepare()
        return type_rules

    def test_type_factory_alias(self) -> None:
        """Responsibilities: _type factory aliases verification_."""
        tree = ast.parse(self._source())
        node_index = PythonAstNodeIndex()
        type_rules = self._type_rules(tree, node_index)
        issues = [issue for node in ast.walk(tree) for issue in type_rules.collect_type_issues(node)]
        self.assertEqual(
            sum(issue["kind"] == "python-type-factory" for issue in issues),
            7,
        )

    def test_reassigned_factory_alias_is_not_reported(self) -> None:
        """Responsibilities: _factory alias reassignment result_."""
        source = """
from typing import TypedDict
Factory = TypedDict
Factory = build_value
Result = Factory("Result", {"value": str})
"""
        tree = ast.parse(source)
        node_index = PythonAstNodeIndex()
        type_rules = self._type_rules(tree, node_index)
        issues = [issue for node in ast.walk(tree) for issue in type_rules.collect_type_issues(node)]

        self.assertFalse(any(issue["kind"] == "python-type-factory" for issue in issues))

    def test_decorator_alias_groups_keep_owned_members(self) -> None:
        """Responsibilities: _decorator alias ownership_."""
        node_index = PythonAstNodeIndex()
        container_assembly = PythonContainerAssembly(node_index)
        aliases = container_assembly.container_aliases()
        references = PythonReferenceAliases(PythonReferenceAliasState())
        state = PythonDecoratorAliasState(aliases, references, node_index)
        state.observe_module(
            ast.parse("from builtins import staticmethod as static_alias\n"),
        )
        alias_groups = state.aliases()
        alias_groups["static"].clear()
        observed_groups = state.aliases()

        self.assertIn("static_alias", observed_groups["static"])

    def _method(self, tree: ast.Module, name: str) -> ast.AST:
        """Responsibilities: _descriptor method selection_."""
        support = PythonReferenceTestSupport()
        functions = support.function_nodes(tree)
        return next(function for function in functions if function.name == name)

    def test_indexes_static_descriptor(self) -> None:
        """Responsibilities: _static descriptor indexing_."""
        tree = ast.parse(
            "class Service:\n    def run(): pass\n    run = staticmethod(run)\n",
        )
        node_index = PythonAstNodeIndex()
        assembly = PythonContainerAssembly(node_index)
        aliases = assembly.container_aliases()
        references = PythonReferenceAliases(PythonReferenceAliasState())
        state = PythonDecoratorAliasState(aliases, references, node_index)
        state.observe_module(tree)
        method = self._method(tree, "run")
        actual_kind = state.assigned_descriptors().kind(method)

        self.assertEqual(actual_kind, "static")

    def test_indexes_class_descriptor(self) -> None:
        """Responsibilities: _class descriptor indexing_."""
        tree = ast.parse(
            "class Service:\n    def run(cls): pass\n    run: object = classmethod(run)\n",
        )
        node_index = PythonAstNodeIndex()
        assembly = PythonContainerAssembly(node_index)
        aliases = assembly.container_aliases()
        references = PythonReferenceAliases(PythonReferenceAliasState())
        state = PythonDecoratorAliasState(aliases, references, node_index)
        state.observe_module(tree)
        method = self._method(tree, "run")
        actual_kind = state.assigned_descriptors().kind(method)

        self.assertEqual(actual_kind, "class")

    def test_reassigned_descriptor_loses_its_kind(self) -> None:
        """Responsibilities: _descriptor reassignment_."""
        tree = ast.parse(
            "class Service:\n    def run(): pass\n    run = staticmethod(run)\n    run = replacement\n",
        )
        node_index = PythonAstNodeIndex()
        assembly = PythonContainerAssembly(node_index)
        aliases = assembly.container_aliases()
        references = PythonReferenceAliases(PythonReferenceAliasState())
        state = PythonDecoratorAliasState(aliases, references, node_index)
        state.observe_module(tree)
        method = self._method(tree, "run")
        actual_kind = state.assigned_descriptors().kind(method)

        self.assertEqual(actual_kind, "")

    def test_tuple_type_aliases(self) -> None:
        """Responsibilities: _tuple type alias classification_."""
        tree = ast.parse(
            "from typing import Tuple as Pair\n"
            "import typing as types\n"
            "TupleAlias = Pair\n"
            "def parse(first: TupleAlias[int, str], second: types.Tuple[int, str], "
            "third: tuple[int, str]) -> None: pass\n",
        )
        container_assembly = PythonContainerAssembly(PythonAstNodeIndex())
        aliases = container_assembly.container_aliases()
        tuple_names = PythonTupleTypeNames(aliases, PythonReferenceAliases(PythonReferenceAliasState()))
        tuple_names.configure(tree)

        support = PythonReferenceTestSupport()
        annotations = support.argument_annotations(tree)

        self.assertEqual(
            [tuple_names.annotation(annotation) for annotation in annotations],
            [True, True, True],
        )
