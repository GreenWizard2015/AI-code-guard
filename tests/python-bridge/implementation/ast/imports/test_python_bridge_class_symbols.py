import ast
import unittest

from implementation.ast.callables.callable_arguments import CallableArguments
from implementation.ast.callables.module_instances.python_module_instance_collector import (
    PythonModuleInstanceCollector,
)
from implementation.ast.callables.scoped_type_aliases import PythonScopedTypeAliases
from implementation.ast.callables.symbol_collection.python_ast_symbol_nodes import (
    PythonAstSymbolNodes,
)
from implementation.ast.callables.symbol_collection.python_ast_symbol_nodes_options import (
    PythonAstSymbolNodesOptions,
)
from implementation.ast.class_nodes.python_class_method_node import (
    PythonClassNodeOptions,
)
from implementation.ast.class_nodes.python_class_node import PythonClassNode
from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.imports.source_segments import SourceSegments
from implementation.ast.type_declarations.python_type_declaration_collector import (
    PythonTypeDeclarationCollector,
)
from implementation.references.aliases.python_container_assembly import (
    PythonContainerAssembly,
)
from implementation.rules.call_analysis.proxy_call.python_proxy_callable_analyzer import (
    PythonProxyCallableAnalyzer,
)
from implementation.rules.call_analysis.proxy_call.python_proxy_callable_syntax import (
    PythonProxyCallableSyntax,
)
from implementation.rules.call_analysis.proxy_call.python_proxy_receiver_aliases import (
    PythonProxyReceiverAliases,
)

from tests.python.constants import CLASS_SOURCE


class PythonBridgeClassSymbolTest(unittest.TestCase):
    """Responsibilities: _class node contract checks_, _instance ownership checks_."""

    """Responsibilities: _Python class-symbol analysis_."""

    def _class_node_options(self) -> PythonClassNodeOptions:
        """Responsibilities: _class node input preparation_."""
        tree = ast.parse(CLASS_SOURCE)
        node_index = PythonAstNodeIndex()
        type_aliases = PythonScopedTypeAliases(tree, node_index)
        type_aliases.collect()
        container_assembly = PythonContainerAssembly(node_index)
        class_declaration = tree.body[1]
        if type(class_declaration) is not ast.ClassDef:
            self.fail("expected class declaration")
        return PythonClassNodeOptions(
            class_declaration,
            CLASS_SOURCE,
            node_index,
            SourceSegments(CLASS_SOURCE),
            container_assembly.container_aliases(),
            type_aliases,
            tree.body,
        )

    def test_named_bases(self) -> None:
        """Responsibilities: _class base names_."""
        class_builder = PythonClassNode(self._class_node_options())
        class_node = class_builder.result
        self.assertEqual(
            (class_node["name"], class_node["base_class_names"]),
            ("Service", ["Record"]),
        )

    def test_method_visibility(self) -> None:
        """Responsibilities: _method visibility_."""
        class_builder = PythonClassNode(self._class_node_options())
        class_node = class_builder.result
        methods = class_node["methods"]
        if type(methods) is not list or not methods:
            self.fail("expected normalized method records")
        first_method = methods[0]
        if type(first_method) is not dict:
            self.fail("expected normalized method object")
        self.assertEqual(first_method["visibility"], "private")
        self.assertNotIn("base_class_name", class_node)

    def test_module_instances_resolve_local_constructor(self) -> None:
        """Responsibilities: _local constructor resolution_."""
        node_index = PythonAstNodeIndex()
        tree = ast.parse(CLASS_SOURCE)
        type_aliases = PythonScopedTypeAliases(tree, node_index)
        type_aliases.collect()
        arguments = CallableArguments(node_index, type_aliases)
        symbols = PythonAstSymbolNodes(
            PythonAstSymbolNodesOptions(
                tree,
                node_index,
                arguments,
                PythonTypeDeclarationCollector(tree, arguments, node_index),
                PythonModuleInstanceCollector(tree),
            ),
        )
        instances = symbols.module_instances()
        instance = instances[0]
        constructor = instance["constructor"]
        if type(constructor) is not str:
            self.fail("expected constructor name")

        self.assertEqual(constructor, "Record")

    def test_module_instances_resolve_imported_constructor(self) -> None:
        """Responsibilities: _imported constructor resolution_."""
        node_index = PythonAstNodeIndex()
        tree = ast.parse("import service\ninstance = service.Record()")
        type_aliases = PythonScopedTypeAliases(tree, node_index)
        type_aliases.collect()
        arguments = CallableArguments(node_index, type_aliases)
        symbols = PythonAstSymbolNodes(
            PythonAstSymbolNodesOptions(
                tree,
                node_index,
                arguments,
                PythonTypeDeclarationCollector(tree, arguments, node_index),
                PythonModuleInstanceCollector(tree),
            ),
        )
        instances = symbols.module_instances()
        instance = instances[0]
        constructor = instance["constructor"]
        if type(constructor) is not str:
            self.fail("expected constructor name")

        self.assertEqual(constructor, "service.Record")

    def test_nested_type_alias_factory_collection(self) -> None:
        """Responsibilities: _nested alias factory detection_."""
        source = (
            "from typing_extensions import TypeAliasType\n"
            "Alias: object = wrap({'nested': [TypeAliasType('Alias', int)]})\n"
        )
        tree = ast.parse(source)
        node_index = PythonAstNodeIndex()
        arguments = CallableArguments(node_index, PythonScopedTypeAliases(tree, node_index))
        collector = PythonTypeDeclarationCollector(tree, arguments, node_index)

        self.assertEqual(collector.declarations(tree.body), [{"name": "Alias", "line": 1}])

    def test_proxy_analysis_reports_forwarding_behavior(self) -> None:
        """Responsibilities: _proxy forwarding classification_."""
        source = (
            "class Service:\n"
            "    def process_item(self, value: str) -> str:\n"
            "        return self._process_item(value=value)\n"
        )
        tree = ast.parse(source)
        aliases = PythonProxyReceiverAliases(tree)
        analyzer = PythonProxyCallableAnalyzer(PythonProxyCallableSyntax(aliases))
        findings = [finding for node in ast.walk(tree) for finding in analyzer.analyze(node)]
        kinds = [finding["kind"] for finding in findings]

        self.assertEqual(kinds, ["proxy-callable"])
