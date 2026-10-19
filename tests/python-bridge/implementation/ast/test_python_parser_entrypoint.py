import ast
import unittest

from implementation.ast.type_declarations.annotation_names import AnnotationNames
from implementation.ast.python_ast_tree import PythonAstTree
from implementation.ast.python_ast_node_index import PythonAstNodeIndex
from implementation.references.call_returns import CallReturns
from implementation.references.python_reference_collector import PythonReferenceCollector
from implementation.ast.symbol_nodes import PythonAstSymbolNodes, PythonAstSymbolNodesOptions
from implementation.ast.callables.callable_arguments import CallableArguments
from implementation.ast.type_declarations.python_type_declaration_collector import PythonTypeDeclarationCollector
from implementation.ast.callables.python_module_instance_collector import PythonModuleInstanceCollector
from tests.python.constants import ENTRYPOINT_SOURCE


class PythonParserMetadataTest(unittest.TestCase):
    """Responsibilities: _parser metadata_, _reference metadata_."""

    def _python_ast_node_index(self) -> PythonAstNodeIndex:
        """Responsibilities: _AST node index instance_."""
        return PythonAstNodeIndex()

    def test_parser_emits_entrypoint_metadata(self) -> None:
        """Responsibilities: _entrypoint metadata values_."""
        tree = PythonAstTree(ENTRYPOINT_SOURCE)
        parsed = tree.ast()
        self.assertEqual(
            {
                "language": parsed["language"],
                "main_guard": parsed["python_main_guard"],
                "import": parsed["python_imports"][0]["module"],
                "docstrings": len(parsed["docstring_spans"]) >= 3,
                "coding": parsed["coding_issues"],
                "holder": any(item["name"] == "Holder" for item in parsed["type_declarations"]),
            },
            {
                "language": "python",
                "main_guard": True,
                "import": "package",
                "docstrings": True,
                "coding": [],
                "holder": True,
            },
        )

    def test_parser_preserves_python_import_statement_kind(self) -> None:
        """Responsibilities: _import statement kinds_."""
        tree = PythonAstTree("import pkg\nfrom pkg import pkg\n")
        parsed = tree.ast()
        imports = parsed["python_imports"]

        self.assertEqual(
            [item["kind"] for item in imports],
            ["import", "from"],
        )

    def test_parser_emits_metadata(self) -> None:
        """Responsibilities: _parser symbol metadata_."""
        tree = ast.parse(ENTRYPOINT_SOURCE)
        symbols = PythonAstSymbolNodes(
            PythonAstSymbolNodesOptions(
                tree,
                self._python_ast_node_index(),
                CallableArguments(self._python_ast_node_index()),
                PythonTypeDeclarationCollector(tree, CallableArguments(self._python_ast_node_index())),
                PythonModuleInstanceCollector(tree),
            )
        )
        collector = PythonReferenceCollector(tree, CallReturns(AnnotationNames()), self._python_ast_node_index())
        references = collector.collect_references()
        self.assertEqual(
            {
                "method": any(item["kind"] == "method" for item in symbols.named_symbols()),
                "reference": any(reference["name"] == "main" for reference in references),
                "docstring": bool(ast.get_docstring(tree)),
            },
            {"method": True, "reference": True, "docstring": True},
        )

    def test_symbol_metadata_preserves_parent_classification(self) -> None:
        """Responsibilities: _symbol parent classification results_."""
        source = """MODULE_VALUE = 1
def module_function(argument: int):
    local_value = argument
    return local_value
class Service:
    field_value = 2
    def method(self, parameter: int):
        method_value = parameter
        return method_value
"""
        tree = PythonAstTree(source)
        parsed = tree.ast()
        symbols = {item["name"]: item for item in parsed["named_symbols"]}

        self.assertEqual(
            {
                "module_function": (
                    symbols["module_function"]["kind"],
                    symbols["module_function"]["is_module_function"],
                ),
                "method": (
                    symbols["method"]["kind"],
                    symbols["method"]["is_module_function"],
                ),
                "module_constant": (
                    symbols["MODULE_VALUE"]["kind"],
                    symbols["MODULE_VALUE"]["is_module_constant"],
                ),
                "class_field": symbols["field_value"]["kind"],
                "local_variable": symbols["local_value"]["kind"],
            },
            {
                "module_function": ("function", True),
                "method": ("method", False),
                "module_constant": ("constant", True),
                "class_field": "field",
                "local_variable": "variable",
            },
        )

    def test_branch_count_reports_only_callables_over_the_limit(self) -> None:
        """Responsibilities: _callable branch count boundaries_."""
        branch_limit = 10
        within_limit = [
            "def within_limit(value: int) -> int:",
            *[
                f"    if value == {index}: value += 1"
                for index in range(branch_limit)
            ],
            "    return value",
        ]
        over_limit = [
            "def over_limit(value: int) -> int:",
            *[
                f"    if value == {index}: value += 1"
                for index in range(branch_limit + 1)
            ],
            "    return value",
        ]
        nested = [
            "def outer(value: int) -> int:",
            "    def nested(value: int) -> int:",
            *[
                f"        if value == {index}: value += 1"
                for index in range(branch_limit + 1)
            ],
            "        return value",
            "    return nested(value)",
        ]
        tree = PythonAstTree("\n".join([*within_limit, *over_limit, *nested]))
        issues = tree.coding_issues()
        branch_issues = [
            issue for issue in issues if issue["kind"] == "callable-branch-count"
        ]

        self.assertEqual(
            sorted(issue["name"] for issue in branch_issues),
            ["nested", "over_limit"],
        )
