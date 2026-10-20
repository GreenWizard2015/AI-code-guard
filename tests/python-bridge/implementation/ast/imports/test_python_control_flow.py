import ast
import unittest

from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.imports.source_segments import SourceSegments
from implementation.references.aliases.python_container_assembly import PythonContainerAssembly
from implementation.references.aliases.python_reference_aliases import PythonReferenceAliases
from implementation.rules.call_analysis.python_builtin_reflection_names import PythonBuiltinReflectionNames
from implementation.references.python_private_vars_mapping import PythonPrivateVarsMapping
from implementation.rules.control_flow.control_flow_issues import PythonControlFlowIssues
from implementation.rules.control_flow.control_flow_issues import PythonControlFlowOptions
from implementation.rules.control_flow.python_predicate_condition import PythonPredicateCondition
from implementation.rules.control_flow.python_terminal_branch_rules import PythonTerminalBranchRules
from implementation.rules.import_rules import ImportRules
from implementation.ast.imports.python_sys_path_rules import PythonSysPathRules
from import_rules_fixture import ImportRulesFixture
from implementation.rules.call_analysis.python_private_access_collector import PythonPrivateAccessCollector
from implementation.rules.call_analysis.python_private_access_options import PythonPrivateAccessOptions
from implementation.rules.call_analysis.python_proxy_callable_analyzer import PythonProxyCallableAnalyzer
from implementation.rules.call_analysis.python_proxy_target import PythonProxyTarget
from implementation.references.python_proxy_receiver_aliases import PythonProxyReceiverAliases

from tests.python.constants import EDGE_SOURCE


class PythonControlFlowTest(unittest.TestCase):
    """Responsibilities: _import control flow checks_, _boolean identity diagnostics_."""

    """Responsibilities: _Python control-flow diagnostics verification_."""

    import_rules_fixture: ImportRulesFixture
    container_assembly: PythonContainerAssembly

    def __init__(self, methodName: str = "runTest") -> None:
        """Responsibilities: _import rules fixture initialization_."""
        super().__init__(methodName)
        self.import_rules_fixture: ImportRulesFixture = ImportRulesFixture()
        self.container_assembly: PythonContainerAssembly = PythonContainerAssembly(PythonAstNodeIndex())

    def _python_ast_node_index(self) -> PythonAstNodeIndex:
        """Responsibilities: _AST index creation_."""
        return PythonAstNodeIndex()

    def _private_count(self, tree: ast.AST) -> int:
        """Responsibilities: _private access count_."""
        aliases = self.container_assembly.container_aliases()
        reflection_names = PythonBuiltinReflectionNames(aliases, PythonReferenceAliases())
        private = PythonPrivateAccessCollector(
            PythonPrivateAccessOptions(
                {
                    "tree": tree,
                    "node_index": self._python_ast_node_index(),
                    "container_aliases": aliases,
                    "container_keys": aliases.container_keys,
                    "reflection_names": reflection_names,
                    "private_vars_mapping": PythonPrivateVarsMapping(
                        reflection_names,
                        aliases.container_keys.string_value,
                    ),
                }
            ),
        )
        return len(private.accesses(private.member_names()))

    def _proxy_count(self, tree: ast.AST) -> int:
        """Responsibilities: _proxy diagnostic count_."""
        proxy_analyzer = PythonProxyCallableAnalyzer(tree, PythonProxyTarget(), PythonProxyReceiverAliases(tree))
        return sum(len(proxy_analyzer.analyze(node)) for node in ast.walk(tree))

    def _conditional_kinds(self, tree: ast.AST) -> set[str]:
        """Responsibilities: _conditional diagnostic kinds_."""
        control = PythonControlFlowIssues(
            PythonControlFlowOptions(
                tree,
                EDGE_SOURCE.splitlines(),
                set(),
                self._python_ast_node_index(),
                PythonPredicateCondition(),
                PythonTerminalBranchRules(),
                SourceSegments(EDGE_SOURCE),
            )
        )
        return {issue["kind"] for node in ast.walk(tree) for issue in control.conditional_issues(node)}

    def test_import_control_flow(self) -> None:
        """Responsibilities: _import diagnostics verification_."""
        tree = ast.parse(EDGE_SOURCE)
        aliases = self.container_assembly.container_aliases()
        node_index = self._python_ast_node_index()
        import_rules = ImportRules(
            aliases,
            self.import_rules_fixture.dynamic_names(aliases),
            PythonSysPathRules(aliases, node_index),
            node_index,
        )
        import_kinds = {issue["kind"] for issue in import_rules.import_issues(tree)}
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
        aliases = self.container_assembly.container_aliases()
        import_rules = ImportRules(
            aliases,
            self.import_rules_fixture.dynamic_names(aliases),
            PythonSysPathRules(aliases, self._python_ast_node_index()),
            self._python_ast_node_index(),
        )

        self.assertEqual(
            [
                issue["line"]
                for issue in import_rules.import_issues(tree)
                if issue["kind"] == "sys_path_mutation"
            ],
            [7, 9, 11],
        )

    def test_rejects_boolean_identity_return_hacks(self) -> None:
        """Responsibilities: _boolean identity hack test_."""
        source = "def check(value: bool) -> None:\n    if value is True:\n        return\n    if value is False:\n        return\n"
        tree = ast.parse(source)
        control = PythonControlFlowIssues(
            PythonControlFlowOptions(
                tree,
                source.splitlines(),
                set(),
                self._python_ast_node_index(),
                PythonPredicateCondition(),
                PythonTerminalBranchRules(),
                SourceSegments(source),
            )
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
