from __future__ import annotations


from typing import Any, TextIO
from time import perf_counter
from implementation.ast.ast_parser import PythonAstTree
from bridge_input import PythonBridgeInput
from implementation.types import JsonObject
from implementation.ast.timed_result import PythonAstTimedResult
from implementation.ast.protocols import PythonAstTimedResultProtocol

parser_type = type[PythonAstTree]


class PythonAstBridge:
    """Responsibilities: _Python source parsing_, _AST responses serialization_."""

    def _syntax_error_result(self, error: SyntaxError) -> JsonObject:
        """Responsibilities: _syntax error result serialization_."""
        line: Any = max(0, (error.lineno or 1) - 1)
        return {
            "language": "python",
            "classes": [],
            "functions": [],
            "python_callable_count": {"count": 0, "first_line": 0},
            "parse_issues": [{"line": line, "message": error.msg}],
            "import_issues": [],
            "attribute_accesses": [],
            "call_references": [],
            "private_accesses": [],
            "repeated_branches": [],
            "module_constant_spans": [],
            "module_type_spans": [],
            "module_protocol_spans": [],
            "module_instances": [],
            "type_members": {},
            "named_symbols": [],
            "type_declarations": [],
            "reference_aliases": [],
            "python_imports": [],
            "python_main_guard": False,
            "docstring_spans": [],
            "responsibility_targets": [],
            "coding_issues": [],
        }

    def __init__(self, parser_type: parser_type) -> None:
        """Responsibilities: _parser implementation initialization_."""
        self.parser_type: Any = parser_type

    def source_ast_timed(self, text: str) -> PythonAstTimedResultProtocol:
        """Responsibilities: _timed source AST parsing_."""
        parse_started = perf_counter()
        try:
            parser: Any = self.parser_type(text)
        except SyntaxError as error:
            return PythonAstTimedResult(
                ast_value=self._syntax_error_result(error),
                parse_ms=(perf_counter() - parse_started) * 1000,
                build_ms=0.0,
                stages={},
            )
        parse_ms = (perf_counter() - parse_started) * 1000
        build_started = perf_counter()
        result: JsonObject = parser.ast()
        build_ms = (perf_counter() - build_started) * 1000
        return PythonAstTimedResult(
            ast_value=result,
            parse_ms=parse_ms,
            build_ms=build_ms,
            stages=parser.timings,
        )

    def source_ast(self, text: str) -> JsonObject:
        """Responsibilities: _source text AST parsing_."""
        result = self.source_ast_timed(text)
        return result.ast_data()

    def stream_ast(self, stream: TextIO) -> JsonObject:
        """Responsibilities: _source text stream parsing_."""
        text: Any = stream.read()
        if not text:
            return self.source_ast("")
        input_source: Any = PythonBridgeInput()
        source: Any = input_source.resolve(text)
        return self.source_ast(source)
