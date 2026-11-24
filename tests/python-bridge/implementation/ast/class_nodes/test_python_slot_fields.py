from __future__ import annotations

import ast
import unittest

from implementation.ast.class_nodes.python_slot_fields import PythonSlotFields
from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.imports.python_ast_node_selection import PythonAstNodeSelection


class PythonSlotFieldsTests(unittest.TestCase):
    """Responsibilities: _slot alias behavior_, _runtime slot filtering_."""

    def test_resolves_module_and_class_aliases(self) -> None:
        """Responsibilities: _module slot names_, _class slot names_."""
        tree = ast.parse(
            'MODULE_SLOTS = ("account_id",)\n'
            "class Account:\n"
            '    LOCAL_SLOTS = ["display_name"]\n'
            "    __slots__ = LOCAL_SLOTS\n",
        )
        module_slots = tree.body[0]
        selection = PythonAstNodeSelection(PythonAstNodeIndex())
        class_declarations = selection.class_definitions(tree)
        account = class_declarations[0]
        slot_fields = PythonSlotFields(account, [module_slots])
        fields = slot_fields.fields()

        self.assertEqual(fields, {"display_name": 3})

    def test_expands_module_alias_container_keys_into_slots(self) -> None:
        """Responsibilities: _module slot alias result_."""
        tree = ast.parse(
            """MODULE_SLOTS = {"account_id": int, "team_id": int}
class Account:
    __slots__ = MODULE_SLOTS
""",
        )
        module_slots = tree.body[0]
        selection = PythonAstNodeSelection(PythonAstNodeIndex())
        class_declarations = selection.class_definitions(tree)
        account = class_declarations[0]
        slot_fields = PythonSlotFields(account, [module_slots])
        fields = slot_fields.fields()

        self.assertEqual(fields, {"account_id": 2, "team_id": 2})

    def test_filters_runtime_slots_from_dictionary_declaration(self) -> None:
        """Responsibilities: _runtime slot exclusion_."""
        tree = ast.parse(
            """class Account:
    __slots__ = {"account_id": str, "__dict__": object, "__weakref__": object}
""",
        )
        selection = PythonAstNodeSelection(PythonAstNodeIndex())
        class_declarations = selection.class_definitions(tree)
        account = class_declarations[0]
        slot_fields = PythonSlotFields(account, [])
        fields = slot_fields.fields()

        self.assertEqual(fields, {"account_id": 1})


if __name__ == "__main__":
    unittest.main()
