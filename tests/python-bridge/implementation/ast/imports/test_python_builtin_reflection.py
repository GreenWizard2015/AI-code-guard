from __future__ import annotations

import ast
import unittest

from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.references.aliases.python_container_alias_state import (
    PythonContainerAliasState,
)
from implementation.references.aliases.python_container_aliases import (
    PythonContainerAliases,
)
from implementation.references.aliases.python_container_items import (
    PythonContainerItems,
)
from implementation.references.aliases.python_container_keys import PythonContainerKeys
from implementation.references.aliases.python_container_values import (
    PythonContainerValues,
)
from implementation.references.aliases.python_reference_aliases import (
    PythonReferenceAliases,
    PythonReferenceAliasState,
)
from implementation.rules.call_analysis.reflection.python_builtin_reflection_names import (
    PythonBuiltinReflectionNames,
)


class PythonBuiltinReflectionTest(unittest.TestCase):
    """Responsibilities: _builtin reflection alias behavior_, _alias state lifecycle_."""

    def _container_aliases(self) -> PythonContainerAliases:
        """Responsibilities: _container alias test state_."""
        state = PythonContainerAliasState(PythonAstNodeIndex())
        keys = PythonContainerKeys(state)
        items = PythonContainerItems(state, keys)
        values = PythonContainerValues(state, keys, items)
        return PythonContainerAliases(state, keys, values, items)

    def _reference_aliases(self) -> PythonReferenceAliases:
        """Responsibilities: _reference alias test state_."""
        return PythonReferenceAliases(PythonReferenceAliasState())

    def test_resolves_import_assignment_and_module_aliases(self) -> None:
        """Responsibilities: _builtin reflection resolution results_."""
        tree = ast.parse(
            "import builtins as runtime\n"
            "from builtins import getattr as lookup\n"
            "read_attribute = lookup\n"
            "inspect_attribute: object = runtime.getattr\n",
        )
        reflection_names = PythonBuiltinReflectionNames(
            self._container_aliases(),
            self._reference_aliases(),
        )
        reflection_names.configure(tree, list(tree.body))
        names = frozenset({"getattr"})
        imported = reflection_names.resolve(ast.Name(id="lookup", ctx=ast.Load()), names)
        assigned = reflection_names.resolve(
            ast.Name(id="read_attribute", ctx=ast.Load()),
            names,
        )
        module = reflection_names.resolve(
            ast.Attribute(
                value=ast.Name(id="runtime", ctx=ast.Load()),
                attr="getattr",
                ctx=ast.Load(),
            ),
            names,
        )
        annotated = reflection_names.resolve(
            ast.Name(id="inspect_attribute", ctx=ast.Load()),
            names,
        )

        self.assertEqual(
            [imported, assigned, module, annotated],
            ["getattr", "getattr", "getattr", "getattr"],
        )

    def test_reconfiguration_drops_previous_aliases(self) -> None:
        """Responsibilities: _reflection alias reset result_."""
        reflection_names = PythonBuiltinReflectionNames(
            self._container_aliases(),
            self._reference_aliases(),
        )
        name = ast.Name(id="lookup", ctx=ast.Load())
        names = frozenset({"getattr"})
        first_tree = ast.parse("from builtins import getattr as lookup")
        reflection_names.configure(first_tree, list(first_tree.body))
        before_reset = reflection_names.resolve(name, names)
        second_tree = ast.parse("pass")
        reflection_names.configure(second_tree, list(second_tree.body))
        after_reset = reflection_names.resolve(name, names)

        self.assertEqual([before_reset, after_reset], ["getattr", ""])
