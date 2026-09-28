from entrypoint import PythonBridgeEntrypoint
from bridge_input import PythonBridgeInput
import ast
import unittest
from dataclasses import dataclass

from implementation.ast.type_declarations.annotation_resolver import AnnotationNames
from implementation.references.call_returns import CallReturns
from implementation.rules.call_analysis.call_rules import CallRules
from implementation.ast.callable_arguments import CallableArguments
from implementation.ast.callable_statements import CallableStatements
from implementation.ast.class_nodes.class_node_builder import PythonClassNode, PythonClassNodeOptions
from implementation.ast.node_index import PythonAstNodeIndex
from implementation.ast.source_segments import SourceSegments
from implementation.references.aliases.container_aliases import PythonContainerAliases
from implementation.rules.control_flow.control_flow_issues import PythonControlFlowIssues
from implementation.rules.default_parameter_issues import PythonDefaultParameterIssues
from implementation.rules.import_rules import ImportRules
from implementation.references.instance_collector import PythonInstanceCollector
from implementation.rules.private_access_collector import PythonPrivateAccessCollector
from implementation.references.property_type_collector import PythonPropertyTypeCollector
from implementation.references.property_type_resolver import PythonPropertyType
from implementation.rules.proxy_callable.proxy_callable_analyzer import PythonProxyCallableAnalyzer
from implementation.references.reference_collector import PythonReferenceCollector
from implementation.references.reference_context import PythonReferenceContext
from implementation.ast.symbol_nodes import PythonAstSymbolNodes
from implementation.rules.python_syntax.type_rules import TypeRules
from implementation.rules.python_syntax.decorator_rules import PythonDecoratorRules
from implementation.rules.union_rules import UnionRules
from implementation.rules.coding_issue_collector import PythonCodingIssueCollector
from implementation.types import JsonObject


from tests.python.constants import (
    TYPE_SOURCE,
    EDGE_SOURCE,
    INSTANCE_SOURCE,
    CLASS_SOURCE,
    BUILTIN_DECORATOR_ALIAS_SOURCE,
    TYPE_FACTORY_ALIAS_SOURCE,
    REFLECTION_ALIAS_SOURCE,
    OPTIONAL_ALIAS_SOURCE,
)


@dataclass(frozen=True)
class InstanceReferenceData:
    """Responsibilities: _reference data retention_."""

    context: PythonReferenceContext
    references: list[JsonObject]


@dataclass(frozen=True)
class ClassSymbolData:
    """Responsibilities: _class symbol data_."""

    name: str
    bases: list[str]
    visibility: str
    helper: bool
    constructor: str
    qualified_constructor: str
    proxy: str


class PythonBridgeTypeTest(unittest.TestCase):
    """Responsibilities: _Python AST outputs verification_."""

    def _node_index(self) -> None:
        """Responsibilities: _AST index creation_."""
        return PythonAstNodeIndex()

    def test_type_symbols(self) -> None:
        """Responsibilities: _type symbols verification_."""
        tree = ast.parse(TYPE_SOURCE)
        type_rules = TypeRules(tree, PythonDecoratorRules())
        symbols = PythonAstSymbolNodes(tree, self._node_index())
        types = [issue for node in ast.walk(tree) for issue in type_rules.collect_type_issues(node)]
        self.assertEqual({
            "factory": "python-type-factory" in {issue["kind"] for issue in types},
            "staticmethod": "python-static-method" in {issue["kind"] for issue in types},
            "classmethod": "python-class-method" in {issue["kind"] for issue in types},
            "alias": "ALIAS" in [item["name"] for item in symbols.type_declarations],
            "constant": any(item["is_module_constant"] for item in symbols.named_symbols if item["name"] == "CONSTANT"),
        }, {"factory": True, "staticmethod": True, "classmethod": True, "alias": True, "constant": True})

    def test_multiple_result_shape_subscript(self) -> None:
        """Responsibilities: _subscript result shape verification_."""
        source = 'value = result["structuredContent"]\n'
        tree = ast.parse(source)
        collector = PythonCodingIssueCollector(tree, source, self._node_index())
        kinds = {issue["kind"] for issue in collector.collect()}
        self.assertIn("multiple-result-shapes", kinds)

    def test_builtin_decorator_aliases(self) -> None:
        """Responsibilities: _builtin decorator aliases verification_."""
        tree = ast.parse(BUILTIN_DECORATOR_ALIAS_SOURCE)
        decorator_rules = PythonDecoratorRules()
        decorator_rules.configure_imports(tree)
        type_rules = TypeRules(tree, decorator_rules)
        kinds = [
            issue["kind"]
            for node in ast.walk(tree)
            for issue in type_rules.collect_type_issues(node)
        ]
        self.assertEqual(
            {
                "static": "python-static-method" in kinds,
                "class": kinds.count("python-class-method"),
            },
            {"static": True, "class": 3},
        )

    def test_builtin_property_alias(self) -> None:
        """Responsibilities: _builtin property alias verification_."""
        tree = ast.parse(
            "from builtins import property as prop\n"
            "\n"
            "class Service:\n"
            "    @prop\n"
            "    def value(self) -> int:\n"
            "        return 1\n"
        )
        collector = PythonCodingIssueCollector(tree, "", self._node_index())
        kinds = {issue["kind"] for issue in collector.collect()}
        self.assertIn("python-property", kinds)

    def test_type_factory_alias(self) -> None:
        """Responsibilities: _type factory aliases verification_."""
        source = TYPE_FACTORY_ALIAS_SOURCE + (
            "\nfrom typing import NamedTuple\n"
            "def publish(record_type):\n"
            "    return record_type\n"
            "def build_record():\n"
            "    return NamedTuple(\"Record\", [])\n"
            "def build_published_record():\n"
            "    return publish(NamedTuple(\"PublishedRecord\", []))\n"
            "register(NamedTuple(\"RegisteredRecord\", []))\n"
        )
        tree = ast.parse(source)
        type_rules = TypeRules(tree, PythonDecoratorRules())
        issues = [
            issue
            for node in ast.walk(tree)
            for issue in type_rules.collect_type_issues(node)
        ]
        self.assertEqual(
            sum(issue["kind"] == "python-type-factory" for issue in issues),
            7,
        )

    def test_annotated_class_init_alias(self) -> None:
        """Responsibilities: _annotated initializer aliases verification_."""
        source = (
            "class Base:\n"
            "    def __init__(self):\n"
            "        pass\n"
            "\n"
            "instance = Base()\n"
            "base_init: Callable = Base.__init__\n"
            "base_init(instance)\n"
        )
        tree = ast.parse(source)
        rules = CallRules(tree, self._node_index())
        rules._configure()
        issues = [
            issue
            for node in ast.walk(tree)
            for issue in rules.collect_call_issues(node)
        ]
        self.assertEqual(
            len([issue for issue in issues if issue["kind"] == "python-direct-class-init"]),
            1,
        )

    def test_local_class_init_alias(self) -> None:
        """Responsibilities: _local initializer aliases verification_."""
        source = (
            "class Base:\n"
            "    def __init__(self):\n"
            "        pass\n"
            "    def control(self):\n"
            "        Base.__init__(self)\n"
            "    def candidate(self):\n"
            "        base_init = Base.__init__\n"
            "        base_init(self)\n"
        )
        tree = ast.parse(source)
        rules = CallRules(tree, self._node_index())
        rules._configure()
        issues = [
            issue
            for node in ast.walk(tree)
            for issue in rules.collect_call_issues(node)
        ]
        self.assertEqual(
            len([issue for issue in issues if issue["kind"] == "python-direct-class-init"]),
            2,
        )

    def test_reflection_alias(self) -> None:
        """Responsibilities: _reflection aliases verification_."""
        tree = ast.parse(REFLECTION_ALIAS_SOURCE)
        rules = CallRules(tree, self._node_index())
        rules._configure()
        issues = [
            issue
            for node in ast.walk(tree)
            for issue in rules.collect_call_issues(node)
        ]
        self.assertIn("getattr", {issue["kind"] for issue in issues})

    def test_union_issues(self) -> None:
        """Responsibilities: _union diagnostics verification_."""
        tree = ast.parse(TYPE_SOURCE)
        type_rules = TypeRules(tree, PythonDecoratorRules())
        unions = UnionRules(tree, self._node_index())
        generic = [issue for node in ast.walk(tree) for issue in type_rules.collect_generic_types(node)]
        union = [issue for node in ast.walk(tree) for issue in unions.collect_union_issues(node)]
        self.assertTrue(generic)
        self.assertIn("nullable-domain-type", {issue["kind"] for issue in union})

    def test_optional_assignment_alias(self) -> None:
        """Responsibilities: _optional assignment aliases verification_."""
        tree = ast.parse(OPTIONAL_ALIAS_SOURCE)
        unions = UnionRules(tree, self._node_index())
        issues = [
            issue
            for node in ast.walk(tree)
            for issue in unions.collect_union_issues(node)
        ]
        self.assertEqual(
            len([issue for issue in issues if issue["kind"] == "nullable-domain-type"]),
            6,
        )

    def test_collects_composite_union_issues(self) -> None:
        """Responsibilities: _composite union diagnostics verification_."""
        tree = ast.parse(
            "Value = A | B\n"
            "def read(value: A | B) -> A | B:\n"
            "    return value\n"
        )
        unions = UnionRules(tree, self._node_index())
        issues = [issue for node in ast.walk(tree) for issue in unions.collect_union_issues(node)]
        self.assertEqual(
            len([issue for issue in issues if issue["kind"] == "composite-state-type"]),
            3,
        )

    def test_collects_composite_intersection_issues(self) -> None:
        """Responsibilities: _composite intersection diagnostics verification_."""
        tree = ast.parse(
            "Value = A & B\n"
            "def read(value: A & B) -> A & B:\n"
            "    return value\n"
        )
        unions = UnionRules(tree, self._node_index())
        issues = [issue for node in ast.walk(tree) for issue in unions.collect_union_issues(node)]
        self.assertEqual(
            len([issue for issue in issues if issue["kind"] == "composite-state-type"]),
            3,
        )

    def test_collects_single_item_array_state_issue(self) -> None:
        """Responsibilities: _array state indexing verification_."""
        tree = ast.parse(
            "def find_service() -> list[Service]:\n"
            "    return []\n"
            "service = find_service()[0]\n"
        )
        collector = PythonCodingIssueCollector(tree, "", self._node_index())
        issues = collector.collect()
        self.assertIn("single-item-array-state", {issue["kind"] for issue in issues})

    def test_collects_single_item_array_state_alias(self) -> None:
        """Responsibilities: _array alias state verification_."""
        tree = ast.parse(
            "def find_service() -> list[Service]:\n"
            "    return []\n"
            "services = find_service()\n"
            "service = services[0]\n"
            "items_alias, ignored = (find_service, None)\n"
            "candidate = items_alias()[0]\n"
        )
        collector = PythonCodingIssueCollector(tree, "", self._node_index())
        issues = collector.collect()
        self.assertEqual(
            [issue["line"] for issue in issues if issue["kind"] == "single-item-array-state"],
            [3, 5],
        )

    def test_annotation_names(self) -> None:
        """Responsibilities: _annotation aliases verification_."""
        resolver = AnnotationNames()
        aliases = {"Alias": "Payload"}
        transparent = {"list", "Optional", "Union"}
        self.assertEqual({
            "plain": resolver.annotation_name(ast.parse("Alias", mode="eval").body, aliases, transparent),
            "generic": resolver.annotation_name(ast.parse("list[Alias] | None", mode="eval").body, aliases, transparent),
            "quoted": resolver.annotation_name(ast.parse('"Alias"', mode="eval").body, aliases, transparent),
            "constructor": resolver.resolve_constructor(ast.parse("Alias()", mode="eval").body, {"Alias"}, aliases),
        }, {"plain": "Payload", "generic": "Payload", "quoted": "Payload", "constructor": "Payload"})

    def test_callable_metadata(self) -> None:
        """Responsibilities: _callable metadata verification_."""
        function = ast.parse("@classmethod\ndef build(self, value: Payload, /, limit: int = 1, *items: str, **options: object):\n    return value\n").body[0]
        arguments = CallableArguments(self._node_index())
        statements = CallableStatements()
        metadata = arguments.argument_metadata(function, arguments.callable_arguments(function), 12)
        self.assertEqual({
            "argument_count": metadata["argument_count"],
            "decorators": metadata["decorators"],
            "statement": statements.statement_node(function.body[0])["kind"],
        }, {"argument_count": 5, "decorators": ["classmethod"], "statement": "return"})


    def test_import_control_flow(self) -> None:
        """Responsibilities: _import diagnostics verification_."""
        tree = ast.parse(EDGE_SOURCE)
        import_rules = ImportRules()
        imports = import_rules.import_issues(tree)
        private = PythonPrivateAccessCollector(tree, self._node_index())
        proxy_analyzer = PythonProxyCallableAnalyzer(tree)
        proxy = [issue for node in ast.walk(tree) for issue in proxy_analyzer.analyze(node)]
        control = PythonControlFlowIssues(
            tree, EDGE_SOURCE.splitlines(), set(), self._node_index()
        )
        conditional = [issue for node in ast.walk(tree) for issue in control.conditional_issues(node)]
        self.assertEqual({
            "late": "late" in {issue["kind"] for issue in imports},
            "relative": "relative" in {issue["kind"] for issue in imports},
            "private": len(private.accesses(private.member_names())) >= 4,
            "proxy": len(proxy),
            "ternary": "ternary-expression" in {issue["kind"] for issue in conditional},
        }, {"late": True, "relative": True, "private": True, "proxy": 2, "ternary": True})

    def test_keyword_proxy_forwarding(self) -> None:
        """Responsibilities: _keyword proxy forwarding verification_."""
        source = "class Service:\n    def process_item(self, value: str) -> str:\n        return self._process_item(value=value)\n"
        tree = ast.parse(source)
        analyzer = PythonProxyCallableAnalyzer(tree)
        issues = [issue for node in ast.walk(tree) for issue in analyzer.analyze(node)]
        self.assertEqual([issue["kind"] for issue in issues], ["proxy-callable"])

    def test_keyword_only_proxy_forwarding(self) -> None:
        """Responsibilities: _keyword-only proxy forwarding verification_."""
        source = "class Service:\n    def process_item(self, *, value: str) -> str:\n        return self._process_item(value=value)\n"
        tree = ast.parse(source)
        analyzer = PythonProxyCallableAnalyzer(tree)
        issues = [issue for node in ast.walk(tree) for issue in analyzer.analyze(node)]
        self.assertEqual([issue["kind"] for issue in issues], ["proxy-callable"])

    def test_variadic_proxy_forwarding(self) -> None:
        """Responsibilities: _variadic proxy forwarding verification_."""
        source = "class Service:\n    def process_items(self, *values: str) -> str:\n        return self._process_items(*values)\n"
        tree = ast.parse(source)
        analyzer = PythonProxyCallableAnalyzer(tree)
        issues = [issue for node in ast.walk(tree) for issue in analyzer.analyze(node)]
        self.assertEqual([issue["kind"] for issue in issues], ["proxy-callable"])

    def test_assignment_control_flow(self) -> None:
        """Responsibilities: _assignment diagnostics verification_."""
        control = PythonControlFlowIssues(
            ast.parse(EDGE_SOURCE), EDGE_SOURCE.splitlines(), set(), self._node_index()
        )
        default_parameters = PythonDefaultParameterIssues(
            ast.parse(EDGE_SOURCE), self._node_index()
        )
        self.assertTrue(control.walrus_issues(ast.parse("(value := 1)", mode="eval").body))
        self.assertFalse(
            default_parameters.complex_default_issues(
                ast.parse("def f(value=[], options={}): pass").body[0]
            )
        )

    def test_reference_tracking(self) -> None:
        """Responsibilities: _reference tracking verification_."""
        tree = ast.parse(INSTANCE_SOURCE)
        aliases = {"ModelAlias": "Model"}
        annotation_resolver = AnnotationNames()
        property_collector = PythonPropertyTypeCollector(
            tree,
            PythonPropertyType(
                aliases, {"Service", "ModelAlias"}, annotation_resolver
            ),
            self._node_index(),
        )
        properties = property_collector.collect_properties()
        data = self._instance_reference_data(tree, aliases, properties)
        self.assertEqual({
            "property": properties["Service.model"],
            "owner": data.context.attribute_owner(ast.parse("self.model", mode="eval").body, "Service"),
            "reference": any(reference["name"] == "save" for reference in data.references),
        }, {"property": "Model", "owner": "Model", "reference": True})

    def _instance_reference_data(
        self,
        tree: ast.AST,
        aliases: dict[str, str],
        properties: dict[str, str],
    ) -> InstanceReferenceData:
        """Responsibilities: _reference context construction_."""
        context = PythonReferenceContext(
            aliases, {"model": "Alias", "unknown": "Any"}, properties,
            {"Service.make": "Model"}
        )
        instances = PythonInstanceCollector(tree, context)
        instances.collect_instances(AnnotationNames())
        instances.collect_for_aliases()
        reference_collector = PythonReferenceCollector(
            tree, CallReturns(AnnotationNames()), PythonAstNodeIndex()
        )
        return InstanceReferenceData(context, reference_collector.collect_references())

    def test_class_symbols(self) -> None:
        """Responsibilities: _class diagnostics verification_."""
        self.assertEqual(
            self._class_symbol_data(),
            ClassSymbolData(
                "Service",
                ["Record"],
                "private",
                True,
                "Record",
                "service.Record",
                "proxy-callable",
            ),
        )


    def _class_symbol_data(self) -> ClassSymbolData:
        """Responsibilities: _class symbol data collection_."""
        tree = ast.parse(CLASS_SOURCE)
        imported_tree = ast.parse("import service\ninstance = service.Record()")
        class_node = self._class_node(tree).result
        symbols = PythonAstSymbolNodes(tree, self._node_index())
        imported_symbols = PythonAstSymbolNodes(imported_tree, self._node_index())
        proxy_analyzer = PythonProxyCallableAnalyzer(tree)
        proxy = [issue for node in ast.walk(tree) for issue in proxy_analyzer.analyze(node)]
        return ClassSymbolData(
            class_node["name"],
            class_node["base_class_names"],
            class_node["methods"][0]["visibility"],
            "helper" in [symbol["name"] for symbol in symbols.named_symbols],
            symbols.module_instances[0]["constructor"],
            imported_symbols.module_instances[0]["constructor"],
            proxy[0]["kind"],
        )

    def _class_node(self, tree: ast.AST) -> PythonClassNode:
        """Responsibilities: _class node construction_."""
        return PythonClassNode(
            PythonClassNodeOptions(
                tree.body[1],
                CLASS_SOURCE,
                self._node_index(),
                SourceSegments(CLASS_SOURCE),
                PythonContainerAliases(),
            ),
        )


if __name__ == "__main__":
    unittest.main()
