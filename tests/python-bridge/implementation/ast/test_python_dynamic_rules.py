import unittest

from implementation.ast.python_ast_tree import PythonAstTree


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

    def test_limits_isinstance_diagnostics_to_business_callables(self) -> None:
        """Responsibilities: _test callable exclusion_, _business isinstance diagnostics_."""
        source = (
            "import ast\n"
            "import unittest\n"
            "class BindingTests(unittest.TestCase):\n"
            "    def test_node_selection(self):\n"
            "        if isinstance(node, ast.FunctionDef):\n"
            "            return node\n"
            "def production(value):\n"
            "    if isinstance(value, str):\n"
            "        return value\n"
        )
        collector = PythonAstTree(source)
        issues = [issue for issue in collector.coding_issues() if issue["kind"] == "python-isinstance"]

        self.assertEqual(issues, [{"line": 7, "kind": "python-isinstance", "name": ""}])

    def test_keeps_dynamic_container_aliases_after_unrelated_rule_state_updates(
        self,
    ) -> None:
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

    def test_tracks_receiver_and_subtest_method_aliases(self) -> None:
        """Responsibilities: _receiver and subtest aliases_."""
        source = (
            "class Tests:\n"
            "    def test_case(self):\n"
            "        receiver = self\n"
            "        subtest = receiver.subTest\n"
            "        with subtest(value=1):\n"
            "            pass\n"
        )
        collector = PythonAstTree(source)
        subtest_issues = [issue for issue in collector.coding_issues() if issue["kind"] == "python-test-subtest"]

        self.assertEqual([issue["line"] for issue in subtest_issues], [4])

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

    def test_collects_dynamic_type_with_unpacked_tuple_arguments(self) -> None:
        """Responsibilities: _tuple-unpacked dynamic type result_."""
        collector = PythonAstTree('created = type("Created", *((), {}))\n')

        self.assertEqual(
            [issue["kind"] for issue in collector.coding_issues() if issue["kind"] == "dynamic-type"],
            ["dynamic-type"],
        )

    def test_async_name_overlay_tracks_local_alias_reassignment(self) -> None:
        """Responsibilities: _async local alias diagnostics_."""
        source = (
            "async def fetch():\n"
            "    return 1\n"
            "\n"
            "def test_fetch():\n"
            "    pending = fetch\n"
            "    pending()\n"
            "    pending = print\n"
            "    pending()\n"
        )
        collector = PythonAstTree(source)
        issues = [issue for issue in collector.coding_issues() if issue["kind"] == "unasserted-async-completion"]

        self.assertEqual(
            [(issue["line"], issue["name"]) for issue in issues],
            [(5, "pending")],
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
        source = "errors = (Exception,)\ntry:\n    raise ValueError()\nexcept errors:\n    pass\n"
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
