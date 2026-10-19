import ast
import unittest

from python_bridge_entrypoint import PythonBridgeEntrypoint
from python_bridge_input import PythonBridgeInput
from implementation.ast.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.python_ast_tree import PythonAstTree
from implementation.rules.control_flow.python_expression_boundary import PythonExpressionBoundary
from implementation.ast.source_segments import SourceSegments
from implementation.rules.control_flow.python_terminal_branch_rules import PythonTerminalBranchRules
from implementation.ast.scoped_type_aliases import PythonScopedTypeAliases
from implementation.coding_issue_options import PythonCodingIssueCollectorOptions
from implementation.python_coding_issue_collector import PythonCodingIssueCollector
from implementation.references.aliases.python_container_aliases import PythonContainerAliases
from implementation.references.aliases.python_reference_aliases import PythonReferenceAliases
from implementation.rules.import_rules import ImportRules
from implementation.rules.control_flow.python_predicate_condition import PythonPredicateCondition
from constants import BUILTINS_DICTIONARY_SOURCE


class PythonDynamicRulesTest(unittest.TestCase):
    """Responsibilities: _dynamic type reference checks_, _broad exception alias checks_."""

    """Responsibilities: _Python dynamic-rule verification_."""

    def __init__(self, methodName: str = "runTest") -> None:
        """Responsibilities: _collector fixture initialization_."""
        super().__init__(methodName)

    def test_collects_dynamic_type_from_builtin_getattr(self) -> None:
        """Responsibilities: _dynamic type reflection_."""
        source = (
            "import builtins\n"
            "type_factory = getattr(builtins, 'type')\n"
            "created_type = type_factory('Created', (), {})\n"
        )
        collector = PythonAstTree(source)
        self.assertEqual(
            [issue["kind"] for issue in collector.coding_issues() if issue["kind"] == "dynamic-type"],
            ["dynamic-type"],
        )

    def test_keeps_dynamic_container_aliases_after_unrelated_rule_state_updates(self) -> None:
        """Responsibilities: _isolated dynamic alias state_."""
        source = (
            "def build():\n"
            '    factories = {"make": type}\n'
            "    marker = 1\n"
            '    return factories["make"]("Created", (), {})\n'
        )
        collector = PythonAstTree(source)

        self.assertEqual(
            [issue["kind"] for issue in collector.coding_issues() if issue["kind"] == "dynamic-type"],
            ["dynamic-type"],
        )

    def test_keeps_module_container_aliases_outside_local_function_scope(self) -> None:
        """Responsibilities: _lexical dynamic alias ownership_."""
        source = (
            'factories = {"make": type}\n'
            "\n"
            "def shadow():\n"
            '    factories = {"make": str}\n'
            "    return 1\n"
            "\n"
            "def build():\n"
            '    return factories["make"]("Created", (), {})\n'
        )
        collector = PythonAstTree(source)

        self.assertEqual(
            [issue["kind"] for issue in collector.coding_issues() if issue["kind"] == "dynamic-type"],
            ["dynamic-type"],
        )

    def test_keeps_subtest_key_aliases_in_their_function_scope(self) -> None:
        """Responsibilities: _subtest alias scope_."""
        source = (
            "class Tests:\n"
            "    def test_first(self):\n"
            '        key = "subTest"\n'
            "        with getattr(self, key)(value=1):\n"
            "            pass\n"
            "\n"
            "    def test_second(self):\n"
            '        key = "other"\n'
            "        with getattr(self, key)(value=2):\n"
            "            pass\n"
        )
        collector = PythonAstTree(source)
        subtest_issues = [issue for issue in collector.coding_issues() if issue["kind"] == "python-test-subtest"]

        self.assertEqual([issue["line"] for issue in subtest_issues], [3])

    def test_collects_dynamic_type_in_raise(self) -> None:
        """Responsibilities: _dynamic type exception_."""
        source = 'raise type("DynamicError", (Exception,), {})("failure")\n'
        collector = PythonAstTree(source)
        self.assertEqual(
            [issue["kind"] for issue in collector.coding_issues() if issue["kind"] == "dynamic-type"],
            ["dynamic-type"],
        )

    def test_collects_dynamic_type_in_expression_statement(self) -> None:
        """Responsibilities: _dynamic type registration_."""
        source = 'registry.setdefault("Dynamic", type("Dynamic", (), {}))\n'
        collector = PythonAstTree(source)
        self.assertEqual(
            [issue["kind"] for issue in collector.coding_issues() if issue["kind"] == "dynamic-type"],
            ["dynamic-type"],
        )

    def test_collects_dynamic_type_with_unpacked_arguments(self) -> None:
        """Responsibilities: _dynamic type unpacking_."""
        source = 'created = type("Created", *[(), {}])\n'
        collector = PythonAstTree(source)
        self.assertEqual(
            [issue["kind"] for issue in collector.coding_issues() if issue["kind"] == "dynamic-type"],
            ["dynamic-type"],
        )

    def test_collects_dynamic_type_in_control_expressions(self) -> None:
        """Responsibilities: _dynamic type control-expression coverage_."""
        source = (
            'if type("Conditional", (), {}):\n'
            "    pass\n"
            'for item in [type("Loop", (), {})]:\n'
            "    pass\n"
            'assert type("Asserted", (), {})\n'
        )
        collector = PythonAstTree(source)
        issues = [issue for issue in collector.coding_issues() if issue["kind"] == "dynamic-type"]
        self.assertEqual(len(issues), 3)

    def test_collects_dynamic_type_through_reflected_builtin(self) -> None:
        """Responsibilities: _reflected dynamic type coverage_."""
        source = 'import builtins\ncreated = getattr(builtins, "type")("Created", (), {})\n'
        collector = PythonAstTree(source)
        self.assertIn("dynamic-type", [issue["kind"] for issue in collector.coding_issues()])

    def test_collects_broad_exception_singleton_tuple_alias(self) -> None:
        """Responsibilities: _broad singleton exception tuple_."""
        source = "errors = (Exception,)\n" "try:\n" "    raise ValueError()\n" "except errors:\n" "    pass\n"
        collector = PythonAstTree(source)
        self.assertEqual(
            [issue["kind"] for issue in collector.coding_issues() if issue["kind"] == "broad-except"],
            ["broad-except"],
        )

    def test_collects_broad_exception_expanded_and_converted_aliases(self) -> None:
        """Responsibilities: _expanded broad exception aliases_."""
        source = (
            "errors = (Exception,)\n"
            "expanded = (*errors,)\n"
            "converted = tuple([Exception])\n"
            "try:\n"
            "    run()\n"
            "except expanded:\n"
            "    pass\n"
            "try:\n"
            "    run()\n"
            "except converted:\n"
            "    pass\n"
        )
        collector = PythonAstTree(source)
        broad_issues = [issue for issue in collector.coding_issues() if issue["kind"] == "broad-except"]
        self.assertEqual(len(broad_issues), 2)


class PythonExceptionAliasRulesTest(unittest.TestCase):
    """Responsibilities: _exception-handler forms_, _dynamic-type contexts_."""

    def test_collects_direct_converted_broad_exception(self) -> None:
        """Responsibilities: _exception alias_."""
        source = "try:\n" "    run()\n" "except tuple([Exception]):\n" "    pass\n"
        collector = PythonAstTree(source)
        self.assertIn("broad-except", [issue["kind"] for issue in collector.coding_issues()])

    def test_collects_dynamic_type_in_with_context(self) -> None:
        """Responsibilities: _context dynamic type_."""
        source = (
            "from contextlib import nullcontext\n"
            'with type("Session", (nullcontext,), {})("value") as session:\n'
            "    str(session)\n"
        )
        collector = PythonAstTree(source)
        self.assertIn("dynamic-type", [issue["kind"] for issue in collector.coding_issues()])

    def test_collects_dynamic_type_in_every_with_context(self) -> None:
        """Responsibilities: _all context dynamic types_."""
        source = (
            "from contextlib import nullcontext\n"
            'with nullcontext(), type("Session", (), {})("value"):\n'
            "    pass\n"
        )
        collector = PythonAstTree(source)
        self.assertEqual(
            [issue["kind"] for issue in collector.coding_issues() if issue["kind"] == "dynamic-type"],
            ["dynamic-type"],
        )

    def test_collects_dynamic_type_in_class_bases(self) -> None:
        """Responsibilities: _class base dynamic type_."""
        source = 'class Record(type("RecordBase", (), {})):\n' "    pass\n"
        collector = PythonAstTree(source)
        self.assertIn(
            "dynamic-type",
            [issue["kind"] for issue in collector.coding_issues()],
        )

    def test_collects_broad_except_star(self) -> None:
        """Responsibilities: _broad except-star_."""
        source = "try:\n" "    raise Exception()\n" "except* Exception:\n" "    pass\n"
        collector = PythonAstTree(source)
        self.assertEqual(
            [issue["kind"] for issue in collector.coding_issues() if issue["kind"] == "broad-except"],
            ["broad-except"],
        )

    def test_collects_starred_exception_alias(self) -> None:
        """Responsibilities: _starred exception tuple_."""
        source = (
            "exceptions = (ValueError, TypeError)\n"
            "try:\n"
            "    raise ValueError()\n"
            "except (*exceptions,):\n"
            "    pass\n"
        )
        collector = PythonAstTree(source)
        self.assertTrue(any(issue["kind"] == "python-multi-except" for issue in collector.coding_issues()))

    def test_list_exception_handlers(self) -> None:
        """Responsibilities: _exception handlers_."""
        source = (
            "try:\n"
            "    run()\n"
            "except tuple([ValueError, TypeError]):\n"
            "    pass\n"
            "errors = [ValueError, TypeError]\n"
            "try:\n"
            "    run()\n"
            "except (*errors,):\n"
            "    pass\n"
        )
        collector = PythonAstTree(source)
        self.assertEqual(
            [issue["kind"] for issue in collector.coding_issues() if issue["kind"] == "python-multi-except"],
            ["python-multi-except", "python-multi-except"],
        )

    def test_collects_sliced_exception_tuple_alias(self) -> None:
        """Responsibilities: _sliced exception sequence coverage_."""
        source = "errors = (ValueError, TypeError)\n" "try:\n" "    run()\n" "except errors[:]:\n" "    pass\n"
        collector = PythonAstTree(source)
        self.assertIn(
            "python-multi-except",
            [issue["kind"] for issue in collector.coding_issues()],
        )

    def test_collects_exception_assignment_alias(self) -> None:
        """Responsibilities: _exception alias coverage_."""
        source = (
            "ExceptionAlias = Exception\n"
            "try:\n"
            "    value = 1\n"
            "except ExceptionAlias:\n"
            "    value = 2\n"
            "\n"
            "multi_exception, ignored = ((ValueError, TypeError), None)\n"
            "try:\n"
            "    value = 3\n"
            "except multi_exception:\n"
            "    value = 4\n"
            "\n"
            "import builtins as bi\n"
            "builtins_alias = bi\n"
            "try:\n"
            "    value = 3\n"
            "except builtins_alias.Exception:\n"
            "    value = 4\n"
        )
        collector = PythonAstTree(source)
        kinds = {issue["kind"] for issue in collector.coding_issues()}
        self.assertIn("broad-except", kinds)

    def test_collects_destructured_broad_exception_alias(self) -> None:
        """Responsibilities: _broad exception alias coverage_."""
        source = (
            "import builtins\n"
            "try:\n"
            "    raise ValueError\n"
            "except builtins.Exception:\n"
            "    pass\n"
            "exception_type, ignored = (builtins.Exception, None)\n"
            "try:\n"
            "    raise ValueError\n"
            "except exception_type:\n"
            "    pass\n"
        )
        collector = PythonAstTree(source)
        broad_issues = [issue for issue in collector.coding_issues() if issue["kind"] == "broad-except"]
        self.assertEqual(len(broad_issues), 2)

    def test_collects_builtins_dictionary_aliases(self) -> None:
        """Responsibilities: _builtins dictionary alias coverage_."""
        collector = PythonAstTree(BUILTINS_DICTIONARY_SOURCE)
        kinds = [issue["kind"] for issue in collector.coding_issues()]
        self.assertEqual(
            {
                "broad": kinds.count("broad-except"),
                "instance": kinds.count("python-isinstance"),
                "static": kinds.count("python-static-method"),
            },
            {"broad": 1, "instance": 1, "static": 1},
        )
