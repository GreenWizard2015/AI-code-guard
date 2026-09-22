import ast
import unittest
from dataclasses import dataclass

from implementation.ast.annotation_resolver import AnnotationNames
from implementation.references.call_returns import CallReturns
from implementation.ast.callable_arguments import CallableArguments
from implementation.ast.callable_statements import CallableStatements
from implementation.ast.class_node_builder import PythonClassNode
from implementation.ast.node_index import PythonAstNodeIndex
from implementation.ast.source_segments import SourceSegments
from implementation.rules.control_flow_issues import PythonControlFlowIssues
from implementation.rules.default_parameter_issues import PythonDefaultParameterIssues
from implementation.rules.import_rules import ImportRules
from implementation.references.instance_collector import PythonInstanceCollector
from implementation.rules.private_access_collector import PythonPrivateAccessCollector
from implementation.references.property_type_collector import PythonPropertyTypeCollector
from implementation.references.property_type_resolver import PythonPropertyType
from implementation.rules.proxy_callable_analyzer import PythonProxyCallableAnalyzer
from implementation.references.reference_collector import PythonReferenceCollector
from implementation.references.reference_context import PythonReferenceContext
from implementation.ast.symbol_nodes import PythonAstSymbolNodes
from implementation.rules.type_rules import TypeRules
from implementation.rules.union_rules import UnionRules
from implementation.rules.coding_issue_collector import PythonCodingIssueCollector
from implementation.types import JsonObject


from tests.python.constants import TYPE_SOURCE, EDGE_SOURCE, INSTANCE_SOURCE, CLASS_SOURCE


@dataclass(frozen=True)
class InstanceReferenceData:
    """Responsibilities: _reference data retention_."""

    context: PythonReferenceContext
    references: list[JsonObject]


class PythonBridgeTypeTest(unittest.TestCase):
    """Responsibilities: _Python AST outputs verification_."""

    def _node_index(self) -> None:
        """Responsibilities: _AST index creation_."""
        return PythonAstNodeIndex()

    def test_type_symbols(self) -> None:
        """Responsibilities: _type symbols verification_."""
        tree = ast.parse(TYPE_SOURCE)
        type_rules = TypeRules()
        symbols = PythonAstSymbolNodes(tree, self._node_index())
        types = [issue for node in ast.walk(tree) for issue in type_rules.collect_type_issues(node)]
        self.assertEqual({
            "factory": "python-type-factory" in {issue["kind"] for issue in types},
            "staticmethod": "python-static-method" in {issue["kind"] for issue in types},
            "classmethod": "python-class-method" in {issue["kind"] for issue in types},
            "alias": "ALIAS" in [item["name"] for item in symbols.type_declarations],
            "constant": any(item["is_module_constant"] for item in symbols.named_symbols if item["name"] == "CONSTANT"),
        }, {"factory": True, "staticmethod": True, "classmethod": True, "alias": True, "constant": True})

    def test_union_issues(self) -> None:
        """Responsibilities: _union diagnostics verification_."""
        tree = ast.parse(TYPE_SOURCE)
        type_rules = TypeRules()
        unions = UnionRules(tree, self._node_index())
        generic = [issue for node in ast.walk(tree) for issue in type_rules.collect_generic_types(node)]
        union = [issue for node in ast.walk(tree) for issue in unions.collect_union_issues(node)]
        self.assertTrue(generic)
        self.assertIn("nullable-domain-type", {issue["kind"] for issue in union})

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

    def test_annotation_names(self) -> None:
        """Responsibilities: _annotation aliases verification_."""
        resolver = AnnotationNames()
        aliases = {"Alias": "Payload"}
        transparent = {"list", "Optional", "Union"}
        self.assertEqual({
            "plain": resolver.annotation_name(ast.parse("Alias", mode="eval").body, aliases, transparent),
            "generic": resolver.annotation_name(ast.parse("list[Alias] | None", mode="eval").body, aliases, transparent),
            "quoted": resolver.annotation_name(ast.parse('"Alias"', mode="eval").body, aliases, transparent),
            "constructor": resolver.constructor_name(ast.parse("Alias()", mode="eval").body, {"Alias"}, aliases),
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
            tree, CallReturns(AnnotationNames())
        )
        return InstanceReferenceData(context, reference_collector.collect_references())

    def test_class_symbols(self) -> None:
        """Responsibilities: _class diagnostics verification_."""
        tree = ast.parse(CLASS_SOURCE)
        builder = PythonClassNode(
            tree.body[1], CLASS_SOURCE, self._node_index(), SourceSegments(CLASS_SOURCE)
        )
        class_node = builder.result
        symbols = PythonAstSymbolNodes(tree, self._node_index())
        proxy_analyzer = PythonProxyCallableAnalyzer(tree)
        proxy = [issue for node in ast.walk(tree) for issue in proxy_analyzer.analyze(node)]
        self.assertEqual({
            "name": class_node["name"],
            "bases": class_node["base_class_names"],
            "visibility": class_node["methods"][0]["visibility"],
            "helper": "helper" in [symbol["name"] for symbol in symbols.named_symbols],
            "constructor": symbols.module_instances[0]["constructor"],
            "proxy": proxy[0]["kind"],
        }, {"name": "Service", "bases": ["Record"], "visibility": "private", "helper": True, "constructor": "Record", "proxy": "proxy-callable"})


if __name__ == "__main__":
    unittest.main()
