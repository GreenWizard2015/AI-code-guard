from __future__ import annotations

from time import perf_counter

from implementation.ast.constants import (
    AST_CLASSES_KEY,
    AST_CLASSIFICATION_KEY,
    AST_CONTROL_FLOW_FIELDS,
    AST_CONTROL_FLOW_KEY,
    AST_DECLARATION_KEY,
    AST_FIELD_ANALYSIS_KEY,
    AST_FIELD_OBJECT_RECORD_REQUIRED,
    AST_FIELD_RECORDS_REQUIRED,
    AST_GROUPED_FIELDS,
    AST_IDENTITY_KEY,
    AST_METHODS_KEY,
    AST_METRICS_KEY,
    AST_MODULE_DECLARATION_FIELDS,
    AST_MODULE_DECLARATIONS_KEY,
    AST_REFERENCE_FIELDS,
    AST_REFERENCES_KEY,
    AST_SIGNATURE_KEY,
    AST_SOURCE_FIELDS,
    AST_SOURCE_KEY,
    AST_STRUCTURE_KEY,
    AST_TEST_BEHAVIOR_KEY,
    CALLABLE_DECLARATION_FIELDS,
    CALLABLE_GROUPED_FIELDS,
    CALLABLE_IDENTITY_FIELDS,
    CALLABLE_METRIC_FIELDS,
    CALLABLE_SIGNATURE_FIELDS,
    CALLABLE_TEST_BEHAVIOR_FIELDS,
    CLASS_FIELD_ANALYSIS_FIELDS,
    CLASS_GROUPED_FIELDS,
    CLASS_IDENTITY_FIELDS,
    CLASS_STRUCTURE_FIELDS,
    CLASSIFICATION_FIELDS,
    FUNCTIONS_KEY,
)
from implementation.ast.protocols import PythonAstParserContract
from implementation.ast.python_ast_timed_result import PythonAstTimedResult
from implementation.rules.constants import (
    PYTHON_PARSE_ISSUES_KEY,
    PYTHON_REFERENCE_ALIASES_KEY,
)
from implementation.types import JsonObject, JsonValueList
from protocols import PythonAstTimedResultContract


class PythonAstBridge:
    """Responsibilities: _Python source parsing_, _AST responses serialization_."""

    def _schema_fields(self, data: JsonObject, fields: frozenset[str]) -> JsonObject:
        """Responsibilities: _AST schema field selection_."""
        selected: JsonObject = {}
        for key, value in data.items():
            if key in fields:
                selected[key] = value
        return selected

    def _object_records(self, data: JsonObject, field: str) -> list[JsonObject]:
        """Responsibilities: _nested AST record extraction_."""
        records = data[field]
        if type(records) is not list:
            raise TypeError(AST_FIELD_RECORDS_REQUIRED.format(field=field))
        result: list[JsonObject] = []
        for record in records:
            if type(record) is not dict:
                raise TypeError(AST_FIELD_OBJECT_RECORD_REQUIRED.format(field=field))
            result.append(record)
        return result

    def _empty_syntax_collections(self) -> JsonObject:
        """Responsibilities: _syntax error collection fields_."""
        return {
            "language": "python",
            AST_CLASSES_KEY: [],
            FUNCTIONS_KEY: [],
            "python_callable_count": {"count": 0, "first_line": 0},
            PYTHON_PARSE_ISSUES_KEY: [],
            "import_issues": [],
            "attribute_accesses": [],
            "call_references": [],
            "literal_references": [],
            "literal_constants": [],
            "private_accesses": [],
            "repeated_branches": [],
        }

    def _empty_syntax_metadata(self) -> JsonObject:
        """Responsibilities: _syntax error metadata fields_."""
        return {
            "module_constant_spans": [],
            "module_type_spans": [],
            "module_protocol_spans": [],
            "module_instances": [],
            "type_members": {},
            "named_symbols": [],
            "type_declarations": [],
            PYTHON_REFERENCE_ALIASES_KEY: [],
            "python_imports": [],
            "python_exports": [],
            "python_main_guard": False,
            "docstring_spans": [],
            "responsibility_targets": [],
            "coding_issues": [],
        }

    def _syntax_error_result(self, error: SyntaxError) -> JsonObject:
        """Responsibilities: _syntax error result serialization_."""
        line = max(0, (error.lineno or 1) - 1)
        result = self._empty_syntax_collections()
        result.update(self._empty_syntax_metadata())
        result[PYTHON_PARSE_ISSUES_KEY] = [{"line": line, "message": error.msg}]
        return self._nested_ast(result)

    def _callable_groups(self, callable_data: JsonObject) -> JsonObject:
        """Responsibilities: _callable schema sections_."""
        return {
            AST_IDENTITY_KEY: self._schema_fields(
                callable_data,
                CALLABLE_IDENTITY_FIELDS,
            ),
            AST_METRICS_KEY: self._schema_fields(callable_data, CALLABLE_METRIC_FIELDS),
            AST_SIGNATURE_KEY: self._schema_fields(
                callable_data,
                CALLABLE_SIGNATURE_FIELDS,
            ),
            AST_TEST_BEHAVIOR_KEY: self._schema_fields(
                callable_data,
                CALLABLE_TEST_BEHAVIOR_FIELDS,
            ),
            AST_DECLARATION_KEY: self._schema_fields(
                callable_data,
                CALLABLE_DECLARATION_FIELDS,
            ),
        }

    def _nested_callable(self, callable_data: JsonObject) -> JsonObject:
        """Responsibilities: _callable schema grouping_."""
        result = {key: value for key, value in callable_data.items() if key not in CALLABLE_GROUPED_FIELDS}
        result.update(self._callable_groups(callable_data))
        return result

    def _class_groups(self, class_data: JsonObject) -> JsonObject:
        """Responsibilities: _class schema sections_."""
        structure = self._schema_fields(class_data, CLASS_STRUCTURE_FIELDS)
        methods = self._object_records(structure, AST_METHODS_KEY)
        nested_methods: JsonValueList = []
        for method in methods:
            nested_methods.append(self._nested_callable(method))
        structure[AST_METHODS_KEY] = nested_methods
        return {
            AST_IDENTITY_KEY: self._schema_fields(class_data, CLASS_IDENTITY_FIELDS),
            AST_STRUCTURE_KEY: structure,
            AST_CLASSIFICATION_KEY: self._schema_fields(
                class_data,
                CLASSIFICATION_FIELDS,
            ),
            AST_FIELD_ANALYSIS_KEY: self._schema_fields(
                class_data,
                CLASS_FIELD_ANALYSIS_FIELDS,
            ),
        }

    def _nested_class(self, class_data: JsonObject) -> JsonObject:
        """Responsibilities: _class schema grouping_."""
        result = {key: value for key, value in class_data.items() if key not in CLASS_GROUPED_FIELDS}
        result.update(self._class_groups(class_data))
        return result

    def _nested_source(self, source_data: JsonObject) -> JsonObject:
        """Responsibilities: _AST source section conversion_."""
        nested_classes: JsonValueList = []
        for class_data in self._object_records(source_data, AST_CLASSES_KEY):
            nested_classes.append(self._nested_class(class_data))
        source_data[AST_CLASSES_KEY] = nested_classes

        nested_callables: JsonValueList = []
        for callable_data in self._object_records(source_data, FUNCTIONS_KEY):
            nested_callables.append(self._nested_callable(callable_data))
        source_data[FUNCTIONS_KEY] = nested_callables
        return source_data

    def _nested_ast_sections(self, ast_data: JsonObject) -> JsonObject:
        """Responsibilities: _AST grouped sections_."""
        source_data = self._schema_fields(ast_data, AST_SOURCE_FIELDS)
        source = self._nested_source(source_data)
        references = self._schema_fields(ast_data, AST_REFERENCE_FIELDS)
        control_flow = self._schema_fields(ast_data, AST_CONTROL_FLOW_FIELDS)
        module_declarations = self._schema_fields(
            ast_data,
            AST_MODULE_DECLARATION_FIELDS,
        )
        return {
            AST_SOURCE_KEY: source,
            AST_REFERENCES_KEY: references,
            AST_CONTROL_FLOW_KEY: control_flow,
            AST_MODULE_DECLARATIONS_KEY: module_declarations,
        }

    def _nested_ast(self, ast_data: JsonObject) -> JsonObject:
        """Responsibilities: _AST schema grouping_."""
        sections = self._nested_ast_sections(ast_data)
        result = {key: value for key, value in ast_data.items() if key not in AST_GROUPED_FIELDS}
        result.update(sections)
        return result

    def __init__(self, parser_type: type[PythonAstParserContract]) -> None:
        """Responsibilities: _source parser dependency setup_."""
        self._parser_type: type[PythonAstParserContract] = parser_type

    def source_ast_timed(self, text: str) -> PythonAstTimedResultContract:
        """Responsibilities: _timed source AST parsing_."""
        parse_started = perf_counter()
        try:
            parser = self._parser_type(text)
        except SyntaxError as error:
            return PythonAstTimedResult(
                ast_value=self._syntax_error_result(error),
                parse_ms=(perf_counter() - parse_started) * 1000,
                build_ms=0.0,
                stages={},
            )
        parse_ms = (perf_counter() - parse_started) * 1000
        build_started = perf_counter()
        result = self._nested_ast(parser.ast())
        build_ms = (perf_counter() - build_started) * 1000
        return PythonAstTimedResult(
            ast_value=result,
            parse_ms=parse_ms,
            build_ms=build_ms,
            stages=parser.timings_data(),
        )

    def source_ast(self, text: str) -> JsonObject:
        """Responsibilities: _source text AST parsing_."""
        result = self.source_ast_timed(text)
        return result.ast_data()
