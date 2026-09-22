from __future__ import annotations


from typing import Any, TextIO
from implementation.ast.ast_parser import PythonAstTree
from bridge_input import PythonBridgeInput
from implementation.types import JsonObject

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
            "parse_issues": [{"line": line, "message": error.msg}],
            "import_issues": [],
            "attribute_accesses": [],
            "call_references": [],
            "private_accesses": [],
            "repeated_branches": [],
            "named_symbols": [],
            "type_declarations": [],
            "reference_aliases": [],
            "docstring_spans": [],
            "responsibility_targets": [],
            "coding_issues": [],
        }

    def __init__(self, parser_type: parser_type) -> None:
        """Responsibilities: _parser implementation initialization_."""
        self.parser_type: Any = parser_type

    def source_ast(self, text: str) -> JsonObject:
        """Responsibilities: _source text AST parsing_."""
        try:
            parser: Any = self.parser_type(text)
            return parser.ast()
        except SyntaxError as error:
            return self._syntax_error_result(error)

    def stream_ast(self, stream: TextIO) -> JsonObject:
        """Responsibilities: _source text stream parsing_."""
        text: Any = stream.read()
        if not text:
            return self.source_ast("")
        input_source: Any = PythonBridgeInput()
        source: Any = input_source.resolve(text)
        return self.source_ast(source)
