from __future__ import annotations

import unittest

from implementation.ast.python_ast_tree import PythonAstTree
from implementation.types import JsonObject, JsonValue, JsonValueList

from tests.python.constants import ENTRYPOINT_SOURCE


class PythonParserOutput:
    """Responsibilities: _parser result access_, _JSON shape assertions_."""

    def __init__(self, test_case: unittest.TestCase, data: JsonObject) -> None:
        """Responsibilities: _parser record binding_."""
        self._test_case: unittest.TestCase = test_case
        self._data: JsonObject = data

    def field(self, name: str) -> JsonValue:
        """Responsibilities: _parser field access_."""
        return self._data[name]

    def text(self, name: str) -> str:
        """Responsibilities: _text metadata access_."""
        value = self.field(name)
        if type(value) is not str:
            self._test_case.fail(f"expected text in {name}")
        return value

    def flag(self, name: str) -> bool:
        """Responsibilities: _boolean metadata access_."""
        value = self.field(name)
        if type(value) is not bool:
            self._test_case.fail(f"expected boolean in {name}")
        return value

    def array(self, name: str) -> JsonValueList:
        """Responsibilities: _parser array access_."""
        value = self.field(name)
        if type(value) is not list:
            self._test_case.fail(f"expected array in {name}")
        return value

    def records(self, name: str) -> list[PythonParserOutput]:
        """Responsibilities: _parser record collection access_."""
        records: list[PythonParserOutput] = []
        for value in self.array(name):
            if type(value) is not dict:
                self._test_case.fail(f"expected object in {name}")
            records.append(PythonParserOutput(self._test_case, value))
        return records


class PythonParserMetadataTest(unittest.TestCase):
    """Responsibilities: _parser metadata_, _reference metadata_."""

    def test_parser_emits_entrypoint_metadata(self) -> None:
        """Responsibilities: _entrypoint metadata values_."""
        tree = PythonAstTree(ENTRYPOINT_SOURCE)
        parsed = tree.ast()
        output = PythonParserOutput(self, parsed)
        imports = output.records("python_imports")
        docstrings = output.array("docstring_spans")
        type_declarations = output.records("type_declarations")
        self.assertEqual(
            {
                "language": output.text("language"),
                "main_guard": output.flag("python_main_guard"),
                "import": imports[0].text("module"),
                "docstrings": len(docstrings) >= 3,
                "coding": output.array("coding_issues"),
                "holder": any(item.text("name") == "Holder" for item in type_declarations),
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

    def test_function_node_record_preserves_normalized_metadata(self) -> None:
        """Responsibilities: _Python callable metadata_."""
        tree = PythonAstTree("def parse_value(value: int) -> int:\n    return value\n")
        parsed = tree.ast()
        output = PythonParserOutput(self, parsed)
        nodes = output.records("functions")
        function = nodes[0]
        statements = function.records("statements")

        self.assertEqual(
            {
                "name": function.text("name"),
                "return_type": function.text("return_type"),
                "nested": function.flag("nested"),
                "statement_kinds": [item.text("kind") for item in statements],
            },
            {
                "name": "parse_value",
                "return_type": "int",
                "nested": False,
                "statement_kinds": ["return"],
            },
        )

    def test_source_ast_serializes_class_methods_only_inside_their_class(self) -> None:
        """Responsibilities: _function ownership_."""
        source = (
            "def module_function():\n"
            "    def nested_function():\n"
            "        return 1\n"
            "    return nested_function()\n"
            "class Service:\n"
            "    def method(self):\n"
            "        return 2\n"
        )
        tree = PythonAstTree(source)
        parsed = tree.ast()
        output = PythonParserOutput(self, parsed)
        functions = output.records("functions")
        classes = output.records("classes")
        methods = classes[0].records("methods")

        self.assertEqual(
            {
                "functions": [item.text("name") for item in functions],
                "methods": [item.text("name") for item in methods],
            },
            {"functions": ["module_function", "nested_function"], "methods": ["method"]},
        )

    def test_callable_argument_context_preserves_decorator_and_parameter_results(self) -> None:
        """Responsibilities: _callable decorator metadata_, _parameter metadata_."""
        source = (
            "class Service:\n"
            "    @classmethod\n"
            "    def build(cls, value: str, fallback):\n"
            "        return value\n"
        )
        tree = PythonAstTree(source)
        parsed = tree.ast()
        output = PythonParserOutput(self, parsed)
        classes = output.records("classes")
        function_nodes = [node for node in classes[0].records("methods") if node.text("name") == "build"]
        function = function_nodes[0]
        typed_arguments = function.records("typed_arguments")

        self.assertEqual(
            {
                "decorators": function.array("decorators"),
                "parameter_types": function.array("parameter_types"),
                "typed_arguments": [
                    {
                        "name": item.text("name"),
                        "type": item.text("type"),
                        "kind": item.text("kind"),
                    }
                    for item in typed_arguments
                ],
                "untyped_parameters": function.array("untyped_parameters"),
            },
            {
                "decorators": ["classmethod"],
                "parameter_types": ["str"],
                "typed_arguments": [{"name": "value", "type": "str", "kind": "basic"}],
                "untyped_parameters": ["fallback"],
            },
        )

    def test_function_call_reference_has_complete_identity_fields(self) -> None:
        """Responsibilities: _function call identity_."""
        tree = PythonAstTree("def run() -> None:\n    return None\n\nrun()\n")
        ast_record = tree.ast()
        output = PythonParserOutput(self, ast_record)
        references = output.records("call_references")
        reference = references[0]

        self.assertEqual(
            {
                "count": len(references),
                "name": reference.text("name"),
                "owner": reference.text("owner"),
                "caller_owner": reference.text("caller_owner"),
                "target_file": reference.text("target_file"),
                "is_call": reference.flag("is_call"),
                "dynamic": reference.flag("dynamic"),
            },
            {
                "count": 1,
                "name": "run",
                "owner": "",
                "caller_owner": "",
                "target_file": "",
                "is_call": True,
                "dynamic": False,
            },
        )

    def test_parser_preserves_python_import_statement_kind(self) -> None:
        """Responsibilities: _import statement kinds_."""
        tree = PythonAstTree("import pkg\nfrom pkg import pkg\n")
        parsed = tree.ast()
        output = PythonParserOutput(self, parsed)
        imports = output.records("python_imports")

        self.assertEqual(
            [item.text("kind") for item in imports],
            ["import", "from"],
        )

    def test_parser_collects_literal_export_list(self) -> None:
        """Responsibilities: _Python export declaration_."""
        tree = PythonAstTree('__all__ = ["First", "Second"]\n')
        parsed = tree.ast()
        output = PythonParserOutput(self, parsed)

        self.assertEqual(output.array("python_exports"), ["First", "Second"])

    def test_parser_collects_augmented_exports_and_nested_docstring_spans(self) -> None:
        """Responsibilities: _export operations_, _scope docstring locations_."""
        source = '''"""module metadata"""
__all__ = ["First"] + ("Second",)
__all__ += {"Third"}
class Holder:
    """class metadata"""
    def run(self):
        """method metadata"""
        return 1
async def load():
    """async metadata"""
    return None
'''
        python_tree = PythonAstTree(source)
        output = PythonParserOutput(self, python_tree.ast())
        docstrings = output.records("docstring_spans")

        self.assertEqual(
            {
                "exports": output.array("python_exports"),
                "docstring_lines": [span.field("start_line") for span in docstrings],
            },
            {"exports": ["First", "Second", "Third"], "docstring_lines": [0, 4, 9, 6]},
        )

    def test_parser_reports_non_list_export_operations(self) -> None:
        """Responsibilities: _export declaration restrictions_."""
        source = """__all__ = ["First"]
__all__ += ["Second"]
__all__.append("Third")
__all__ = BASE_EXPORTS
__all__ = ["Fourth"] + ["Fifth"]
__all__: list[str] = ["Sixth"]
"""
        tree = PythonAstTree(source)
        parsed = tree.ast()
        output = PythonParserOutput(self, parsed)
        issues = output.records("coding_issues")
        issue_data = [
            {"kind": issue.text("kind"), "line": issue.field("line"), "name": issue.text("name")}
            for issue in issues
            if issue.text("kind") == "python-all-list-assignment"
        ]

        self.assertEqual(
            issue_data,
            [
                {"kind": "python-all-list-assignment", "line": 1, "name": ""},
                {"kind": "python-all-list-assignment", "line": 2, "name": ""},
                {"kind": "python-all-list-assignment", "line": 3, "name": ""},
                {"kind": "python-all-list-assignment", "line": 4, "name": ""},
                {"kind": "python-all-list-assignment", "line": 5, "name": ""},
            ],
        )

    def test_parser_excludes_export_names_from_runtime_literal_references(self) -> None:
        """Responsibilities: _runtime literal reference classification_."""
        source = """__all__ = ["ProjectBrowserBridge", "UpstreamGatewayDependencies"]
def first() -> str:
    return "shared runtime message"
def second() -> str:
    return "shared runtime message"
"""
        tree = PythonAstTree(source)
        parsed = tree.ast()
        output = PythonParserOutput(self, parsed)

        self.assertEqual(
            [item.text("value") for item in output.records("literal_references")],
            ["shared runtime message", "shared runtime message"],
        )

    def test_parser_emits_metadata(self) -> None:
        """Responsibilities: _parser symbol metadata_."""
        tree = PythonAstTree(ENTRYPOINT_SOURCE)
        parsed = tree.ast()
        output = PythonParserOutput(self, parsed)
        symbols = output.records("named_symbols")
        references = output.records("call_references")
        self.assertEqual(
            {
                "method": any(item.text("kind") == "method" for item in symbols),
                "reference": any(reference.text("name") == "main" for reference in references),
                "docstring": bool(output.array("docstring_spans")),
            },
            {"method": True, "reference": True, "docstring": True},
        )

    def test_reference_owner_context_restores_after_nested_class(self) -> None:
        """Responsibilities: _nested class ownership context_."""
        source = (
            "class Outer:\n"
            "    def execute(self):\n"
            "        self.before()\n"
            "        class Nested:\n"
            "            def run(self):\n"
            "                self.inside()\n"
            "        self.after()\n"
        )
        tree = PythonAstTree(source)
        parsed = tree.ast()
        output = PythonParserOutput(self, parsed)
        references = output.records("call_references")
        observed = [
            (reference.text("name"), reference.text("owner"))
            for reference in references
            if reference.text("name") in {"before", "inside", "after"}
        ]
        self.assertEqual(observed, [("before", "Outer"), ("inside", "Nested"), ("after", "Outer")])

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
        output = PythonParserOutput(self, parsed)
        symbols = {item.text("name"): item for item in output.records("named_symbols")}

        self.assertEqual(
            {
                "module_function": (
                    symbols["module_function"].text("kind"),
                    symbols["module_function"].flag("is_module_function"),
                ),
                "method": (
                    symbols["method"].text("kind"),
                    symbols["method"].flag("is_module_function"),
                ),
                "module_constant": (
                    symbols["MODULE_VALUE"].text("kind"),
                    symbols["MODULE_VALUE"].flag("is_module_constant"),
                ),
                "class_field": symbols["field_value"].text("kind"),
                "local_variable": symbols["local_value"].text("kind"),
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
            *[f"    if value == {index}: value += 1" for index in range(branch_limit)],
            "    return value",
        ]
        over_limit = [
            "def over_limit(value: int) -> int:",
            *[f"    if value == {index}: value += 1" for index in range(branch_limit + 1)],
            "    return value",
        ]
        nested = [
            "def outer(value: int) -> int:",
            "    def nested(value: int) -> int:",
            *[f"        if value == {index}: value += 1" for index in range(branch_limit + 1)],
            "        return value",
            "    return nested(value)",
        ]
        tree = PythonAstTree("\n".join([*within_limit, *over_limit, *nested]))
        issues = tree.coding_issues()
        issue_records = [PythonParserOutput(self, issue) for issue in issues]
        branch_issues = [issue for issue in issue_records if issue.text("kind") == "callable-branch-count"]

        self.assertEqual(
            sorted(issue.text("name") for issue in branch_issues),
            ["nested", "over_limit"],
        )
