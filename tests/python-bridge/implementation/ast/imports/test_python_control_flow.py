import ast
import unittest

from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.imports.python_sys_path_rules import PythonSysPathRules
from implementation.ast.imports.source_segments import SourceSegments
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
from implementation.rules.control_flow.control_flow_issues import (
    PythonControlFlowIssues,
    PythonControlFlowOptions,
)
from implementation.rules.control_flow.python_temporal_coupling import (
    PythonTemporalCoupling,
)
from implementation.rules.control_flow.python_terminal_branch_rules import (
    PythonTerminalBranchRules,
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

    def _private_count(self, tree: ast.AST) -> int:
        """Responsibilities: _private access count_."""
        source_text = ast.unparse(tree)
        python_tree = PythonAstTree(source_text)
        parsed = python_tree.ast()
        match parsed["private_accesses"]:
            case list() as accesses:
                return len(accesses)
            case _:
                return -1

    def _proxy_count(self, tree: ast.AST) -> int:
        """Responsibilities: _proxy diagnostic count_."""
        proxy_analyzer = PythonProxyCallableAnalyzer(
            PythonProxyCallableSyntax(PythonProxyReceiverAliases(tree)),
        )
        return sum(len(proxy_analyzer.analyze(node)) for node in ast.walk(tree))

    def _conditional_kinds(self, tree: ast.AST) -> set[str]:
        """Responsibilities: _conditional diagnostic kinds_."""
        control = PythonControlFlowIssues(
            PythonControlFlowOptions(
                tree,
                EDGE_SOURCE.splitlines(),
                set(),
                self._python_ast_node_index(),
                PythonTerminalBranchRules(),
                SourceSegments(EDGE_SOURCE),
            ),
        )
        kinds: set[str] = set()
        for node in ast.walk(tree):
            for issue in control.conditional_issues(node):
                match issue.get("kind"):
                    case str() as kind:
                        kinds.add(kind)
        return kinds

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
        import_kinds: set[str] = set()
        for issue in import_rules.import_issues(tree):
            match issue.get("kind"):
                case str() as kind:
                    import_kinds.add(kind)
        self.assertEqual(
            {
                "late": "late" in import_kinds,
                "relative": "relative" in import_kinds,
                "private": self._private_count(tree) >= 4,
                "proxy": self._proxy_count(tree),
                "ternary": "ternary-expression" in self._conditional_kinds(tree),
            },
            {"late": True, "relative": True, "private": True, "proxy": 2, "ternary": True},
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
        tree = PythonAstTree(source)
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

    def test_temporal_coupling_reads_async_method_names(self) -> None:
        """Responsibilities: _async field dependency detection_."""
        source = (
            "class Worker:\n"
            "    def prepare(self):\n"
            "        self.state = 'ready'\n"
            "    async def run(self):\n"
            "        return self.state\n"
        )
        tree = ast.parse(source)
        node_index = self._python_ast_node_index()
        node_index.nodes(tree)
        coupling = PythonTemporalCoupling(node_index)
        issues = coupling.issues(tree)

        self.assertEqual(
            [{"kind": issue["kind"], "line": issue["line"], "name": issue["name"]} for issue in issues],
            [{"kind": "temporal-coupling", "line": 1, "name": "state"}],
        )

    def test_temporal_coupling_ignores_fields_after_receiver_reassignment(self) -> None:
        """Responsibilities: _receiver variable reassignment ownership_."""
        source = (
            "class Worker:\n"
            "    def prepare(self):\n"
            "        self = temporary\n"
            "        self.state = 'ready'\n"
            "    def run(self):\n"
            "        return self.state\n"
        )
        tree = ast.parse(source)
        node_index = self._python_ast_node_index()
        node_index.nodes(tree)
        coupling = PythonTemporalCoupling(node_index)

        self.assertEqual(coupling.issues(tree), [])

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

    def test_detects_sys_path_mutation_through_instance_field(self) -> None:
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

    def test_sys_path_mutator_aliases_reset_between_trees(self) -> None:
        """Responsibilities: _sys path alias lifecycle_."""
        first_tree = ast.parse("import sys\nadd_path = sys.path.append\n")
        second_tree = ast.parse("pass\n")
        call_source = ast.parse("add_path('/tmp')\n")
        call = next(node for node in ast.walk(call_source) if type(node) is ast.Call)
        rules = PythonSysPathRules(
            self._container_aliases(),
            self._python_ast_node_index(),
        )
        rules.configure(first_tree)
        before_reset = rules.path_mutation(call)
        rules.configure(second_tree)
        after_reset = rules.path_mutation(call)
        self.assertEqual([before_reset, after_reset], [True, False])

    def test_sys_path_instance_aliases_reset_between_trees(self) -> None:
        """Responsibilities: _instance path alias lifecycle_."""
        first_tree = ast.parse(
            "import sys\n"
            "class Settings:\n"
            "    def __init__(self):\n"
            "        self.paths = sys.path\n"
            "    def add(self, path):\n"
            "        self.paths.append(path)\n",
        )
        second_tree = ast.parse(
            "class Settings:\n    def add(self, path):\n        self.paths.append(path)\n",
        )
        rules = PythonSysPathRules(
            self._container_aliases(),
            self._python_ast_node_index(),
        )
        first_call = next(node for node in ast.walk(first_tree) if type(node) is ast.Call)
        second_call = next(node for node in ast.walk(second_tree) if type(node) is ast.Call)
        rules.configure(first_tree)
        found_before_reset = rules.path_mutation(first_call)
        rules.configure(second_tree)
        found_after_reset = rules.path_mutation(second_call)

        self.assertEqual([found_before_reset, found_after_reset], [True, False])

    def test_rejects_boolean_identity_return_hacks(self) -> None:
        """Responsibilities: _boolean identity hack test_."""
        source = (
            "def check(value: bool) -> None:\n"
            "    if value is True:\n"
            "        return\n"
            "    if value is False:\n"
            "        return\n"
        )
        tree = ast.parse(source)
        control = PythonControlFlowIssues(
            PythonControlFlowOptions(
                tree,
                source.splitlines(),
                set(),
                self._python_ast_node_index(),
                PythonTerminalBranchRules(),
                SourceSegments(source),
            ),
        )

        self.assertEqual(
            [
                issue["kind"]
                for node in ast.walk(tree)
                for issue in control.conditional_issues(node)
                if issue["kind"] == "pointless-boolean-operation"
            ],
            ["pointless-boolean-operation", "pointless-boolean-operation"],
        )

    def test_preserves_identity_check_for_mapping_values(self) -> None:
        """Responsibilities: _mapping value identity preservation_."""
        source = (
            "def is_error(result: dict[str, object]) -> bool:\n"
            '    if result.get("isError") is True:\n'
            "        return True\n"
            "    return False\n"
        )
        tree = ast.parse(source)
        control = PythonControlFlowIssues(
            PythonControlFlowOptions(
                tree,
                source.splitlines(),
                set(),
                self._python_ast_node_index(),
                PythonTerminalBranchRules(),
                SourceSegments(source),
            ),
        )

        self.assertEqual(
            [
                issue
                for node in ast.walk(tree)
                for issue in control.conditional_issues(node)
                if issue["kind"] == "pointless-boolean-operation"
            ],
            [],
        )

    def test_reports_long_single_line_logical_chain(self) -> None:
        """Responsibilities: _single-line logical chain diagnosis_."""
        source = "def check(a, b, c, d):\n    return a and b and c and d\n"
        tree = ast.parse(source)
        control = PythonControlFlowIssues(
            PythonControlFlowOptions(
                tree,
                source.splitlines(),
                set(),
                self._python_ast_node_index(),
                PythonTerminalBranchRules(),
                SourceSegments(source),
            ),
        )

        self.assertEqual(
            [issue["kind"] for node in ast.walk(tree) for issue in control.conditional_issues(node)],
            ["logical-chain-size"],
        )

    def test_reports_unknown_calls_without_name_based_exceptions(self) -> None:
        """Responsibilities: _conditional call issues_."""
        source = (
            "def _is_receiver(value):\n"
            "    return True\n"
            "def check(arguments):\n"
            "    return len(arguments) == 1 and not _is_receiver(arguments[0])\n"
            "def run(ready):\n"
            "    return ready and perform_action()\n"
            "def verify(ready):\n"
            "    return ready and ready.perform()\n"
            "def compute(ready):\n"
            "    return ready and _compute_value()\n"
        )
        tree = ast.parse(source)
        control = PythonControlFlowIssues(
            PythonControlFlowOptions(
                tree,
                source.splitlines(),
                set(),
                self._python_ast_node_index(),
                PythonTerminalBranchRules(),
                SourceSegments(source),
            ),
        )

        self.assertEqual(
            [
                issue["kind"]
                for node in ast.walk(tree)
                for issue in control.conditional_issues(node)
                if issue["kind"] == "conditional-execution"
            ],
            [
                "conditional-execution",
                "conditional-execution",
                "conditional-execution",
                "conditional-execution",
            ],
        )
