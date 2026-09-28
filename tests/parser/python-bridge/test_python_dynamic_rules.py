import ast
import unittest

from entrypoint import PythonBridgeEntrypoint
from bridge_input import PythonBridgeInput
from implementation.ast.node_index import PythonAstNodeIndex
from implementation.rules.coding_issue_collector import PythonCodingIssueCollector
from implementation.rules.import_rules import ImportRules
from constants import BUILTINS_DICTIONARY_SOURCE


class PythonDynamicRulesTest(unittest.TestCase):
    """Responsibilities: _Python dynamic-rule verification_."""

    def _node_index(self) -> PythonAstNodeIndex:
        """Responsibilities: _AST index creation_."""
        return PythonAstNodeIndex()

    def test_collects_dynamic_type_from_builtin_getattr(self) -> None:
        """Responsibilities: _dynamic type reflection_."""
        source = (
            "import builtins\n"
            "type_factory = getattr(builtins, 'type')\n"
            "created_type = type_factory('Created', (), {})\n"
        )
        tree = ast.parse(source)
        collector = PythonCodingIssueCollector(tree, source, self._node_index())
        self.assertEqual(
            [issue["kind"] for issue in collector.collect() if issue["kind"] == "dynamic-type"],
            ["dynamic-type"],
        )

    def test_collects_dynamic_type_in_raise(self) -> None:
        """Responsibilities: _dynamic type exception_."""
        source = 'raise type("DynamicError", (Exception,), {})("failure")\n'
        tree = ast.parse(source)
        collector = PythonCodingIssueCollector(tree, source, self._node_index())
        self.assertEqual(
            [issue["kind"] for issue in collector.collect() if issue["kind"] == "dynamic-type"],
            ["dynamic-type"],
        )

    def test_collects_broad_except_star(self) -> None:
        """Responsibilities: _broad except-star_."""
        source = (
            "try:\n"
            "    raise Exception()\n"
            "except* Exception:\n"
            "    pass\n"
        )
        tree = ast.parse(source)
        collector = PythonCodingIssueCollector(tree, source, self._node_index())
        self.assertEqual(
            [issue["kind"] for issue in collector.collect() if issue["kind"] == "broad-except"],
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
        tree = ast.parse(source)
        collector = PythonCodingIssueCollector(tree, source, self._node_index())
        self.assertTrue(
            any(issue["kind"] == "python-multi-except" for issue in collector.collect())
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
        tree = ast.parse(source)
        collector = PythonCodingIssueCollector(tree, source, self._node_index())
        kinds = {issue["kind"] for issue in collector.collect()}
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
        tree = ast.parse(source)
        collector = PythonCodingIssueCollector(tree, source, self._node_index())
        broad_issues = [
            issue for issue in collector.collect() if issue["kind"] == "broad-except"
        ]
        self.assertEqual(len(broad_issues), 2)

    def test_collects_builtins_dictionary_aliases(self) -> None:
        """Responsibilities: _builtins dictionary alias coverage_."""
        tree = ast.parse(BUILTINS_DICTIONARY_SOURCE)
        collector = PythonCodingIssueCollector(
            tree, BUILTINS_DICTIONARY_SOURCE, self._node_index()
        )
        kinds = [issue["kind"] for issue in collector.collect()]
        self.assertEqual(
            {
                "broad": kinds.count("broad-except"),
                "instance": kinds.count("python-isinstance"),
                "static": kinds.count("python-static-method"),
            },
            {"broad": 1, "instance": 1, "static": 1},
        )
