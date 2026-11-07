import ast
import unittest

from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.rules.call_analysis.python_name_binding_index import PythonNameBindingIndex
from implementation.rules.constants import (
    PYTHON_MODULE_NAME_ABSENT,
    PYTHON_MODULE_NAME_BOUND,
    PYTHON_MODULE_NAME_REASSIGNED,
)


class PythonNameBindingRepeatedQueriesTest(unittest.TestCase):
    """Responsibilities: _module binding lookup_, _callable ownership_."""

    def test_repeated_module_queries_keep_import_and_assignment_results(self) -> None:
        """Responsibilities: _module binding result reuse_."""
        tree = ast.parse("import package.submodule\nmodule_value = 1\n")
        node_index = PythonAstNodeIndex()
        indexed_nodes = node_index.nodes(tree)
        binding_index = PythonNameBindingIndex(tree, node_index)
        binding_index.index_tree()
        names = ("package", "module_value", "missing_name")
        results = {name: binding_index.module_binding(name) for name in names for _ in range(2)}

        self.assertEqual(
            {
                "package": results["package"],
                "module_value": results["module_value"],
                "missing_name": results["missing_name"],
                "snapshot_reused": node_index.nodes(tree) is indexed_nodes,
            },
            {
                "package": PYTHON_MODULE_NAME_BOUND,
                "module_value": PYTHON_MODULE_NAME_REASSIGNED,
                "missing_name": PYTHON_MODULE_NAME_ABSENT,
                "snapshot_reused": True,
            },
        )

    def test_repeated_local_queries_keep_per_callable_ownership(self) -> None:
        """Responsibilities: _per-callable binding ownership_."""
        source_lines = [
            "def outer(outer_parameter):\n",
            "    outer_local = 1\n",
            "    shadowed = 2\n",
            "    def inner(inner_parameter):\n",
            "        inner_only = 3\n",
            "        shadowed = 4\n",
        ]
        tree = ast.parse("".join(source_lines))
        node_index = PythonAstNodeIndex()
        binding_index = PythonNameBindingIndex(tree, node_index)
        binding_index.index_tree()
        functions = {node.name: node for node in node_index.nodes(tree) if isinstance(node, ast.FunctionDef)}
        outer = functions["outer"]
        inner = functions["inner"]
        names = ("outer_local", "inner_only", "outer_parameter", "inner_parameter", "shadowed")
        ownership = {
            name: (
                binding_index.function_binds(outer, name),
                binding_index.function_binds(inner, name),
            )
            for name in names
        }

        self.assertEqual(
            ownership,
            {
                "outer_local": (True, False),
                "inner_only": (False, True),
                "outer_parameter": (True, False),
                "inner_parameter": (False, True),
                "shadowed": (True, True),
            },
        )

    def test_class_body_bindings_stay_out_of_module_scope(self) -> None:
        """Responsibilities: _class body scope boundaries_."""
        source_lines = [
            "import package.submodule\n",
            "from package.module import Thing as ImportedThing\n",
            "class DeclaredType:\n",
            "    class_body_name = 1\n",
            "    def method(parameter):\n",
            "        local_name = 2\n",
        ]
        tree = ast.parse("".join(source_lines))
        node_index = PythonAstNodeIndex()
        binding_index = PythonNameBindingIndex(tree, node_index)
        binding_index.index_tree()
        method = next(node for node in node_index.nodes(tree) if isinstance(node, ast.FunctionDef))
        module_bindings = {
            name: binding_index.module_binding(name)
            for name in ("package", "ImportedThing", "DeclaredType", "class_body_name", "method")
        }
        method_bindings = {
            name: binding_index.function_binds(method, name) for name in ("parameter", "local_name", "class_body_name")
        }

        self.assertEqual(
            {"module": module_bindings, "method": method_bindings},
            {
                "module": {
                    "package": PYTHON_MODULE_NAME_BOUND,
                    "ImportedThing": PYTHON_MODULE_NAME_BOUND,
                    "DeclaredType": PYTHON_MODULE_NAME_BOUND,
                    "class_body_name": PYTHON_MODULE_NAME_ABSENT,
                    "method": PYTHON_MODULE_NAME_ABSENT,
                },
                "method": {"parameter": True, "local_name": True, "class_body_name": False},
            },
        )

    def test_module_class_and_callable_bindings_keep_scope_boundaries(self) -> None:
        """Responsibilities: _module class callable scopes_."""
        source_lines = [
            "module_value = 1\n",
            "class DeclaredType:\n",
            "    class_value = 2\n",
            "    class NestedType:\n",
            "        nested_class_value = 3\n",
            "    def method(parameter):\n",
            "        callable_value = 4\n",
        ]
        tree = ast.parse("".join(source_lines))
        node_index = PythonAstNodeIndex()
        binding_index = PythonNameBindingIndex(tree, node_index)
        binding_index.index_tree()
        method = next(
            node for node in node_index.nodes(tree) if type(node) is ast.FunctionDef and node.name == "method"
        )
        names = (
            "module_value",
            "DeclaredType",
            "class_value",
            "NestedType",
            "nested_class_value",
            "method",
            "parameter",
            "callable_value",
        )

        self.assertEqual(
            {
                name: (
                    binding_index.module_binding(name),
                    binding_index.function_binds(method, name),
                )
                for name in names
            },
            {
                "module_value": (PYTHON_MODULE_NAME_REASSIGNED, False),
                "DeclaredType": (PYTHON_MODULE_NAME_BOUND, False),
                "class_value": (PYTHON_MODULE_NAME_ABSENT, False),
                "NestedType": (PYTHON_MODULE_NAME_ABSENT, False),
                "nested_class_value": (PYTHON_MODULE_NAME_ABSENT, False),
                "method": (PYTHON_MODULE_NAME_ABSENT, False),
                "parameter": (PYTHON_MODULE_NAME_ABSENT, True),
                "callable_value": (PYTHON_MODULE_NAME_ABSENT, True),
            },
        )

    def test_module_declarations_keep_binding_states_and_nested_scope(self) -> None:
        """Responsibilities: _module declaration binding states_."""
        source_lines = [
            "import package.submodule\n",
            "def module_function():\n",
            "    return 1\n",
            "class DeclaredType:\n",
            "    class_body_name = 2\n",
            "    def method(parameter):\n",
            "        import json as nested_import\n",
            "        local_name = 3\n",
            "assigned_value = 4\n",
        ]
        tree = ast.parse("".join(source_lines))
        node_index = PythonAstNodeIndex()
        binding_index = PythonNameBindingIndex(tree, node_index)
        binding_index.index_tree()
        functions = {node.name: node for node in node_index.nodes(tree) if isinstance(node, ast.FunctionDef)}
        module_bindings = {
            name: binding_index.module_binding(name)
            for name in (
                "package",
                "module_function",
                "DeclaredType",
                "assigned_value",
                "class_body_name",
                "method",
            )
        }
        method_bindings = {
            name: binding_index.function_binds(functions["method"], name)
            for name in ("parameter", "nested_import", "local_name", "class_body_name", "module_function")
        }

        self.assertEqual(
            {"module": module_bindings, "method": method_bindings},
            {
                "module": {
                    "package": PYTHON_MODULE_NAME_BOUND,
                    "module_function": PYTHON_MODULE_NAME_BOUND,
                    "DeclaredType": PYTHON_MODULE_NAME_BOUND,
                    "assigned_value": PYTHON_MODULE_NAME_REASSIGNED,
                    "class_body_name": PYTHON_MODULE_NAME_ABSENT,
                    "method": PYTHON_MODULE_NAME_ABSENT,
                },
                "method": {
                    "parameter": True,
                    "nested_import": True,
                    "local_name": True,
                    "class_body_name": False,
                    "module_function": False,
                },
            },
        )
