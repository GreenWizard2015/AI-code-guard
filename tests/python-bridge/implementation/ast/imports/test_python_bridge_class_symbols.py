import ast
import unittest

from implementation.ast.callables.callable_arguments import CallableArguments
from implementation.ast.callables.python_module_instance_collector import PythonModuleInstanceCollector
from implementation.ast.class_nodes.class_node_builder import PythonClassNode, PythonClassNodeOptions
from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.callables.scoped_type_aliases import PythonScopedTypeAliases
from implementation.ast.imports.source_segments import SourceSegments
from implementation.ast.callables.symbol_nodes import PythonAstSymbolNodes, PythonAstSymbolNodesOptions
from implementation.ast.type_declarations.python_type_declaration_collector import PythonTypeDeclarationCollector
from implementation.references.aliases.python_container_assembly import PythonContainerAssembly
from implementation.references.python_proxy_receiver_aliases import PythonProxyReceiverAliases
from implementation.rules.call_analysis.python_proxy_callable_analyzer import PythonProxyCallableAnalyzer
from implementation.rules.call_analysis.python_proxy_target import PythonProxyTarget
from tests.python.constants import CLASS_SOURCE


class PythonBridgeClassSymbolTest(unittest.TestCase):
    """Responsibilities: _class node contract checks_, _instance ownership checks_."""

    """Responsibilities: _Python class-symbol analysis_."""

    def test_class_node_base_and_visibility(self) -> None:
        """Responsibilities: _class node structure_."""
        tree = ast.parse(CLASS_SOURCE)
        node_index = PythonAstNodeIndex()
        type_aliases = PythonScopedTypeAliases(tree, node_index)
        type_aliases.collect()
        container_assembly = PythonContainerAssembly(node_index)
        class_builder = PythonClassNode(
            PythonClassNodeOptions(
                tree.body[1],
                CLASS_SOURCE,
                node_index,
                SourceSegments(CLASS_SOURCE),
                container_assembly.container_aliases(),
                type_aliases,
                tree.body,
            )
        )
        class_node = class_builder.result
        methods = class_node["methods"]
        first_method = methods[0]

        self.assertEqual(
            (class_node["name"], class_node["base_class_names"], first_method["visibility"]),
            ("Service", ["Record"], "private"),
        )

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
                PythonTypeDeclarationCollector(tree, arguments),
                PythonModuleInstanceCollector(tree),
            )
        )
        instances = symbols.module_instances()
        instance = instances[0]
        constructor = instance["constructor"]

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
                PythonTypeDeclarationCollector(tree, arguments),
                PythonModuleInstanceCollector(tree),
            )
        )
        instances = symbols.module_instances()
        instance = instances[0]
        constructor = instance["constructor"]

        self.assertEqual(constructor, "service.Record")

    def test_proxy_analysis_reports_forwarding_behavior(self) -> None:
        """Responsibilities: _proxy forwarding classification_."""
        source = "class Service:\n    def process_item(self, value: str) -> str:\n        return self._process_item(value=value)\n"
        tree = ast.parse(source)
        aliases = PythonProxyReceiverAliases(tree)
        analyzer = PythonProxyCallableAnalyzer(tree, PythonProxyTarget(), aliases)
        findings = [finding for node in ast.walk(tree) for finding in analyzer.analyze(node)]
        kinds = [finding["kind"] for finding in findings]

        self.assertEqual(kinds, ["proxy-callable"])
