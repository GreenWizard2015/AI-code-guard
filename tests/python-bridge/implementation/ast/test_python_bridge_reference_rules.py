import ast
import unittest
from dataclasses import dataclass

from implementation.ast.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.type_declarations.annotation_names import AnnotationNames
from implementation.references.call_returns import CallReturns
from implementation.references.python_call_return_state_adapter import PythonCallReturnStateAdapter
from implementation.references.instances.python_instance_collector import PythonInstanceCollector
from implementation.references.instances.python_property_type import PythonPropertyType
from implementation.references.instances.python_property_type_collector import PythonPropertyTypeCollector
from implementation.references.python_reference_collector import PythonReferenceCollector
from implementation.references.python_reference_context import PythonReferenceContext
from implementation.references.context.python_reference_context_options import PythonReferenceContextOptions
from implementation.references.context.python_reference_symbol_tables import PythonReferenceSymbolTables
from implementation.references.aliases.python_reference_aliases import PythonReferenceAliases
from implementation.types import JsonObject
from tests.python.constants import INSTANCE_SOURCE


@dataclass(frozen=True)
class InstanceReferenceData:
    """Responsibilities: _reference context_, _invocation records_."""

    context: PythonReferenceContext
    references: list[JsonObject]


class PythonBridgeReferenceTest(unittest.TestCase):
    """Responsibilities: _instance owner checks_, _imported alias checks_."""

    def _python_ast_node_index(self) -> PythonAstNodeIndex:
        """Responsibilities: _AST index creation_."""
        return PythonAstNodeIndex()

    def test_reference_tracking(self) -> None:
        """Responsibilities: _reference tracking verification_."""
        tree = ast.parse(INSTANCE_SOURCE)
        aliases = {"ModelAlias": "Model"}
        annotation_resolver = AnnotationNames()
        property_collector = PythonPropertyTypeCollector(
            tree,
            PythonPropertyType(aliases, {"Service", "ModelAlias"}, annotation_resolver),
            self._python_ast_node_index(),
        )

        properties = property_collector.collect_properties()
        data = self._instance_reference_data(tree, aliases, properties)
        self.assertEqual(
            {
                "property": properties["Service.model"],
                "owner": data.context.attribute_owner(ast.parse("self.model", mode="eval").body, "Service"),
                "reference": any(reference["name"] == "save" for reference in data.references),
            },
            {"property": "Model", "owner": "Model", "reference": True},
        )

    def test_reference_alias_resolution_keeps_first_alias_and_reuses_index(self) -> None:
        """Responsibilities: _indexed alias resolution verification_."""
        aliases = PythonReferenceAliases()
        tree = ast.parse("import package.one as first\nimport package.two as second\n")
        aliases.collect(tree)
        aliases.aliases.append({"name": "first", "target": "ignored"})

        self.assertEqual(
            {
                "first": aliases.resolved_name("first", frozenset()),
                "second": aliases.resolved_name("second", frozenset()),
            },
            {"first": "package.one", "second": "package.two"},
        )

    def _instance_reference_data(
        self,
        tree: ast.AST,
        aliases: dict[str, str],
        properties: dict[str, str],
    ) -> InstanceReferenceData:
        """Responsibilities: _reference context construction_."""
        node_index = self._python_ast_node_index()
        node_index.nodes(tree)
        context = PythonReferenceContext(
            PythonReferenceContextOptions(
                PythonReferenceSymbolTables(
                    aliases, {"model": "Alias", "unknown": "Any"}, properties, {}
                ),
                PythonCallReturnStateAdapter({"Service.make": "Model"}),
                node_index,
            )
        )
        instances = PythonInstanceCollector(tree, context, node_index)
        instances.collect_instances(AnnotationNames())
        instances.collect_for_aliases()
        python_reference_collector = PythonReferenceCollector(
            tree, CallReturns(AnnotationNames()), PythonAstNodeIndex()
        )
        return InstanceReferenceData(context, python_reference_collector.collect_references())
