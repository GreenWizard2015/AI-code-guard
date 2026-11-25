import ast
import unittest

from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.imports.python_sys_path_rules import PythonSysPathRules
from implementation.ast.python_ast_tree import PythonAstTree
from implementation.references.aliases.python_container_alias_state import (
    PythonContainerAliasState,
)
from implementation.references.aliases.python_container_aliases import (
    PythonContainerAliases,
)
from implementation.references.aliases.python_container_items import (
    PythonContainerItems,
)
from implementation.references.aliases.python_container_keys import PythonContainerKeys
from implementation.references.aliases.python_container_values import (
    PythonContainerValues,
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
from implementation.rules.import_rules import ImportRules
from import_rules_fixture import ImportRulesFixture

from tests.python.constants import EDGE_SOURCE


class PythonControlFlowTest(unittest.TestCase):
    """Responsibilities: _import control flow checks_, _boolean identity diagnostics_."""

    """Responsibilities: _Python control-flow diagnostics verification_."""

    _import_rules_fixture: ImportRulesFixture

    def __init__(self, methodName: str = "runTest") -> None:
        """Responsibilities: _import rules fixture initialization_."""
        super().__init__(methodName)
        self._import_rules_fixture: ImportRulesFixture = ImportRulesFixture()

    def _python_ast_node_index(self) -> PythonAstNodeIndex:
        """Responsibilities: _AST index creation_."""
        return PythonAstNodeIndex()

    def _container_aliases(self) -> PythonContainerAliases:
        """Responsibilities: _concrete container alias setup_."""
        state = PythonContainerAliasState(self._python_ast_node_index())
        keys = PythonContainerKeys(state)
        items = PythonContainerItems(state, keys)
        values = PythonContainerValues(state, keys, items)
        return PythonContainerAliases(state, keys, values, items)

    def _has_private_accesses(self, tree: ast.AST) -> bool:
        """Responsibilities: _private access presence_."""
        source_text = ast.unparse(tree)
        python_tree = PythonAstTree(source_text, ast.parse(source_text))
        parsed = python_tree.ast()
        return bool(parsed["private_accesses"])

    def _proxy_count(self, tree: ast.AST) -> int:
        """Responsibilities: _proxy diagnostic count_."""
        proxy_analyzer = PythonProxyCallableAnalyzer(
            PythonProxyCallableSyntax(PythonProxyReceiverAliases(tree)),
        )
        return sum(len(proxy_analyzer.analyze(node)) for node in ast.walk(tree))

    def test_import_control_flow(self) -> None:
        """Responsibilities: _import diagnostics verification_."""
        tree = ast.parse(EDGE_SOURCE)
        aliases = self._container_aliases()
        node_index = self._python_ast_node_index()
        import_rules = ImportRules(
            self._import_rules_fixture.dynamic_names(aliases),
            PythonSysPathRules(aliases, node_index),
            node_index,
        )
        import_kinds = {issue["kind"] for issue in import_rules.import_issues(tree)}
        self.assertEqual(
            {
                "late": "late" in import_kinds,
                "relative": "relative" in import_kinds,
                "private": self._has_private_accesses(tree),
                "proxy": self._proxy_count(tree),
            },
            {"late": True, "relative": True, "private": True, "proxy": 2},
        )

    def test_import_analysis_keeps_dynamic_and_path_mutation_results(self) -> None:
        """Responsibilities: _import dispatch results_."""
        source = (
            "import importlib\n"
            "import sys\n"
            "def load_module() -> object:\n"
            "    loader = importlib.import_module\n"
            "    return loader('module')\n"
            "sys.path.append('module-path')\n"
        )
        tree = PythonAstTree(source, ast.parse(source))
        issues = tree.analysis_state().imports().import_rules().import_issues(tree.tree())

        self.assertCountEqual(
            [issue["kind"] for issue in issues],
            ["sys_path_mutation", "dynamic"],
        )

    def test_nested_import_scope_matches_indexed_preorder(self) -> None:
        """Responsibilities: _nested import scope classification_."""
        source = (
            "if enabled:\n"
            "    import json\n"
            "\n"
            "def load():\n"
            "    import pathlib\n"
            "\n"
            "class Model:\n"
            "    import re\n"
        )
        tree = ast.parse(source)
        aliases = self._container_aliases()
        node_index = self._python_ast_node_index()
        import_rules = ImportRules(
            self._import_rules_fixture.dynamic_names(aliases),
            PythonSysPathRules(aliases, node_index),
            node_index,
        )
        nested_lines = [issue["line"] for issue in import_rules.import_issues(tree) if issue["kind"] == "nested"]

        self.assertEqual(nested_lines, [4, 7])

    def test_sys_path_import_aliases_drive_mutation_diagnostics(self) -> None:
        """Responsibilities: _aliased sys.path mutation results_."""
        source = (
            "import sys as runtime\n"
            "from sys import path as search_path\n"
            "runtime.path.append('runtime')\n"
            "search_path.append('imported')\n"
        )
        tree = ast.parse(source)
        aliases = self._container_aliases()
        node_index = self._python_ast_node_index()
        rules = ImportRules(
            self._import_rules_fixture.dynamic_names(aliases),
            PythonSysPathRules(aliases, node_index),
            node_index,
        )

        self.assertEqual(
            [issue["line"] for issue in rules.import_issues(tree) if issue["kind"] == "sys_path_mutation"],
            [2, 3],
        )

    def test_instance_path_alias_is_detected(self) -> None:
        """Responsibilities: _instance-held import path mutation_."""
        source = (
            "import sys\n"
            "\n"
            "class ImportConfiguration:\n"
            "    def __init__(owner) -> None:\n"
            "        owner.search_paths = sys.path\n"
            "\n"
            "    def add_import_root(instance, path: str) -> None:\n"
            "        instance.search_paths.append(path)\n"
            "        current_paths = instance.search_paths\n"
            "        current_paths.append(path)\n"
            "        append_path = instance.search_paths.append\n"
            "        append_path(path)\n"
            "\n"
            "class LocalSearchConfiguration:\n"
            "    def __init__(self) -> None:\n"
            "        self.search_paths = []\n"
            "\n"
            "    def add_local_root(self, path: str) -> None:\n"
            "        self.search_paths.append(path)\n"
        )
        tree = ast.parse(source)
        aliases = self._container_aliases()
        import_rules = ImportRules(
            self._import_rules_fixture.dynamic_names(aliases),
            PythonSysPathRules(aliases, self._python_ast_node_index()),
            self._python_ast_node_index(),
        )

        self.assertEqual(
            [issue["line"] for issue in import_rules.import_issues(tree) if issue["kind"] == "sys_path_mutation"],
            [7, 9, 11],
        )

    def test_configured_sys_path_mutator_alias_is_detected(self) -> None:
        """Responsibilities: _sys path alias recognition_."""
        tree = ast.parse("import sys\nadd_path = sys.path.append\n")
        call = ast.Call(
            func=ast.Name(id="add_path", ctx=ast.Load()),
            args=[ast.Constant(value="temporary-path")],
            keywords=[],
        )
        rules = PythonSysPathRules(
            self._container_aliases(),
            self._python_ast_node_index(),
        )
        rules.configure(tree)

        self.assertTrue(rules.path_mutation(call))

    def test_reconfiguration_clears_sys_path_mutator_aliases(self) -> None:
        """Responsibilities: _sys path alias reset_."""
        first_tree = ast.parse("import sys\nadd_path = sys.path.append\n")
        second_tree = ast.parse("pass\n")
        call = ast.Call(
            func=ast.Name(id="add_path", ctx=ast.Load()),
            args=[ast.Constant(value="temporary-path")],
            keywords=[],
        )
        rules = PythonSysPathRules(
            self._container_aliases(),
            self._python_ast_node_index(),
        )
        rules.configure(first_tree)
        rules.configure(second_tree)

        self.assertFalse(rules.path_mutation(call))

    def test_reconfiguration_clears_instance_path_aliases(self) -> None:
        """Responsibilities: _instance path alias reset_."""
        call = ast.Call(
            func=ast.Attribute(
                value=ast.Attribute(value=ast.Name(id="self", ctx=ast.Load()), attr="paths", ctx=ast.Load()),
                attr="append",
                ctx=ast.Load(),
            ),
            args=[ast.Name(id="path", ctx=ast.Load())],
            keywords=[],
        )
        path_assignment = ast.Assign(
            targets=[
                ast.Attribute(value=ast.Name(id="self", ctx=ast.Load()), attr="paths", ctx=ast.Store()),
            ],
            value=ast.Attribute(value=ast.Name(id="sys", ctx=ast.Load()), attr="path", ctx=ast.Load()),
        )
        initializer = ast.FunctionDef(
            name="__init__",
            args=ast.arguments(
                posonlyargs=[],
                args=[ast.arg(arg="self")],
                kwonlyargs=[],
                kw_defaults=[],
                defaults=[],
            ),
            body=[path_assignment],
            decorator_list=[],
        )
        add_path = ast.FunctionDef(
            name="add",
            args=ast.arguments(
                posonlyargs=[],
                args=[ast.arg(arg="self"), ast.arg(arg="path")],
                kwonlyargs=[],
                kw_defaults=[],
                defaults=[],
            ),
            body=[ast.Expr(value=call)],
            decorator_list=[],
        )
        settings = ast.ClassDef(name="Settings", bases=[], keywords=[], body=[initializer, add_path], decorator_list=[])
        tree = ast.Module(body=[ast.Import(names=[ast.alias(name="sys")]), settings], type_ignores=[])
        rules = PythonSysPathRules(
            self._container_aliases(),
            self._python_ast_node_index(),
        )
        rules.configure(tree)
        rules.configure(ast.parse("pass\n"))

        self.assertFalse(rules.path_mutation(call))
