from __future__ import annotations

import ast
import unittest

from implementation.rules.python_syntax.python_type_factory_names import PythonTypeFactoryNames
from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.references.aliases.python_container_assembly import PythonContainerAssembly
from implementation.references.aliases.python_reference_aliases import PythonReferenceAliases
from implementation.rules.python_syntax.decorators.python_decorator_alias_state import PythonDecoratorAliasState
from implementation.rules.python_syntax.decorators.python_decorator_rules import PythonDecoratorRules
from implementation.rules.type_rules.type_rules import TypeRules
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

    def test_type_factory_alias(self) -> None:
        """Responsibilities: _type factory aliases verification_."""
        tree = ast.parse(self._source())
        node_index = PythonAstNodeIndex()
        container_assembly = PythonContainerAssembly(node_index)
        aliases = container_assembly.container_aliases()
        references = PythonReferenceAliases()
        decorator_aliases = PythonDecoratorAliasState(aliases, references)
        type_factory_names = PythonTypeFactoryNames(aliases, references)
        type_factory_names.configure(tree)
        type_rules = TypeRules(
            tree,
            PythonDecoratorRules(
                aliases,
                references,
                decorator_aliases,
                decorator_aliases.assigned_descriptors,
            ),
            type_factory_names,
        )
        issues = [issue for node in ast.walk(tree) for issue in type_rules.collect_type_issues(node)]
        self.assertEqual(
            sum(issue["kind"] == "python-type-factory" for issue in issues),
            7,
        )
        self.assertTrue(type_factory_names.matches(ast.Name(id="TD", ctx=ast.Load())))

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
        container_assembly = PythonContainerAssembly(node_index)
        aliases = container_assembly.container_aliases()
        references = PythonReferenceAliases()
        decorator_aliases = PythonDecoratorAliasState(aliases, references)
        type_factory_names = PythonTypeFactoryNames(aliases, references)
        type_factory_names.configure(tree)
        type_rules = TypeRules(
            tree,
            PythonDecoratorRules(
                aliases,
                references,
                decorator_aliases,
                decorator_aliases.assigned_descriptors,
            ),
            type_factory_names,
        )
        issues = [issue for node in ast.walk(tree) for issue in type_rules.collect_type_issues(node)]

        self.assertFalse(type_factory_names.matches(ast.Name(id="Factory", ctx=ast.Load())))
        self.assertFalse(any(issue["kind"] == "python-type-factory" for issue in issues))
