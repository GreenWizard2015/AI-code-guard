import ast
import unittest

from implementation.ast.callables.scoped_type_aliases import PythonScopedTypeAliases
from implementation.ast.class_nodes.python_class_method_node import (
    PythonClassNodeOptions,
)
from implementation.ast.class_nodes.python_class_node_fields import (
    PythonClassNodeFields,
)
from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.imports.source_segments import SourceSegments
from implementation.references.aliases.python_container_assembly import (
    PythonContainerAssembly,
)
from implementation.types import JsonObject


class PythonClassNodeFieldsTest(unittest.TestCase):
    """Responsibilities: _field scope classification_, _field annotation classification_."""

    def _source_text(self) -> str:
        """Responsibilities: _field collection source setup_."""
        return """\
class Cache:
    class_count: int = 0
    def __init__(self):
        self.entries: dict[str, int] = {}
        self.cache_size = 0
        if self.cache_size:
            self.cache_size = 1
        local_count = 0
    def reset(self):
        self.reset_count = 0
"""

    def _class_declaration(self, module: ast.Module) -> ast.ClassDef:
        """Responsibilities: _class declaration extraction_."""
        declaration = module.body[0]
        if type(declaration) is not ast.ClassDef:
            self.fail("expected class declaration")
        return declaration

    def _options(self, module: ast.Module, node: ast.ClassDef, source: str) -> PythonClassNodeOptions:
        """Responsibilities: _class field-analysis inputs_."""
        node_index = PythonAstNodeIndex()
        container_assembly = PythonContainerAssembly(node_index)
        container_aliases = container_assembly.container_aliases()
        return PythonClassNodeOptions(
            node,
            source,
            node_index,
            SourceSegments(source),
            container_aliases,
            PythonScopedTypeAliases(module, node_index),
            module.body,
        )

    def _field_summary(self, fields: list[JsonObject]) -> list[JsonObject]:
        """Responsibilities: _field ownership result projection_."""
        summary: list[JsonObject] = []
        for field in fields:
            name = field["name"]
            if type(name) is not str:
                self.fail("normalized field name must be text")
            summary.append(
                {
                    "name": name,
                    "class_scope": field["class_scope"],
                    "type_kind": field["type_kind"],
                    "class_variable": field["class_variable"],
                },
            )
        return summary

    def test_normalizes_constructor_and_method_fields_with_ownership(self) -> None:
        """Responsibilities: _field scope classification_."""
        module = ast.parse(self._source_text())
        class_node = self._class_declaration(module)
        field_analysis = PythonClassNodeFields(self._options(module, class_node, self._source_text()))
        actual_fields = self._field_summary(field_analysis.fields())
        self.assertEqual(
            actual_fields,
            [
                {
                    "name": "class_count",
                    "class_scope": True,
                    "type_kind": "basic",
                    "class_variable": False,
                },
                {
                    "name": "entries",
                    "class_scope": False,
                    "type_kind": "generic",
                    "class_variable": False,
                },
                {
                    "name": "cache_size",
                    "class_scope": False,
                    "type_kind": "basic",
                    "class_variable": False,
                },
                {
                    "name": "reset_count",
                    "class_scope": False,
                    "type_kind": "basic",
                    "class_variable": False,
                },
            ],
        )
        self.assertEqual(
            [field["name"] for field in field_analysis.declared_fields()],
            ["class_count"],
        )

    def test_collects_only_untyped_method_fields(self) -> None:
        """Responsibilities: _untyped field collection_."""
        module = ast.parse(self._source_text())
        class_node = self._class_declaration(module)
        field_analysis = PythonClassNodeFields(self._options(module, class_node, self._source_text()))
        typed_fields = field_analysis.fields()
        untyped_fields = field_analysis.untyped_field_records().collect(typed_fields)
        untyped_names = set()
        for field in untyped_fields:
            name = field["name"]
            if type(name) is str:
                untyped_names.add(name)
        self.assertEqual(untyped_names, {"cache_size", "reset_count"})

    def test_ignores_assignments_inside_nested_callable_and_class(self) -> None:
        """Responsibilities: _method execution scope_, _nested declaration boundary_."""
        source = """\
class Cache:
    def reset(self):
        self.owned_count = 0
        def nested_reset():
            self.nested_count = 0
        class Nested:
            def create(self):
                self.nested_class_count = 0
"""
        module = ast.parse(source)
        class_node = self._class_declaration(module)
        field_analysis = PythonClassNodeFields(self._options(module, class_node, source))
        fields = field_analysis.fields()

        self.assertEqual([field["name"] for field in fields], ["owned_count"])


if __name__ == "__main__":
    unittest.main()
