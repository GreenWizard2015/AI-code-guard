import ast
import unittest

from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex


class PythonAstNodeIndexTest(unittest.TestCase):
    """Responsibilities: _AST parent indexing_, _shared child ownership_."""

    def test_keeps_breadth_first_source_node_order(self) -> None:
        """Responsibilities: _ordered AST traversal results_."""
        module = ast.parse("class Item:\n    value = left + right\n")
        index = PythonAstNodeIndex()

        self.assertEqual(index.nodes(module), list(ast.walk(module)))

    def test_returns_the_same_cached_node_list_for_repeated_lookups(self) -> None:
        """Responsibilities: _Python AST node-list caching_."""
        module = ast.parse("value = left + right")
        index = PythonAstNodeIndex()
        first_nodes = index.nodes(module)
        second_nodes = index.nodes(module)

        self.assertIs(second_nodes, first_nodes)

    def test_caches_alias_events_in_node_order(self) -> None:
        """Responsibilities: _ordered alias event reuse_."""
        module = ast.parse(
            "import os\nvalue = 1\nempty: int\nfilled: int = 2\n",
        )
        index = PythonAstNodeIndex()
        nodes = index.nodes(module)
        expected = [module.body[0], module.body[1], module.body[3]]
        events = index.alias_event_nodes(module, nodes)

        self.assertEqual(events, expected)
        self.assertIs(index.alias_event_nodes(module, nodes), events)

    def test_caches_alias_events_for_subtrees(self) -> None:
        """Responsibilities: _subtree alias event reuse_."""
        module = ast.parse("def run():\n    value = 1\n    empty: int\n")
        function = next(node for node in module.body if type(node) is ast.FunctionDef)
        index = PythonAstNodeIndex()
        subtree_nodes = index.nodes(function)
        expected = [node for node in subtree_nodes if type(node) is ast.Assign]
        events = index.alias_event_nodes(function, subtree_nodes)

        self.assertEqual(events, expected)
        self.assertIs(index.alias_event_nodes(function, subtree_nodes), events)

    def test_filters_custom_node_lists_without_changing_their_scope(self) -> None:
        """Responsibilities: _custom alias event selection_."""
        module = ast.parse("first = 1\nsecond = 2\n")
        index = PythonAstNodeIndex()
        first_assignment = module.body[0]
        custom_nodes = [first_assignment]

        self.assertEqual(index.alias_event_nodes(module, custom_nodes), [first_assignment])

    def test_collects_class_definitions_in_breadth_first_order_and_reuses_them(self) -> None:
        """Responsibilities: _ordered class definition lookup_."""
        module = ast.parse("class Outer:\n    class Nested:\n        pass\n\nclass Other:\n    pass\n")
        index = PythonAstNodeIndex()
        expected = [node for node in ast.walk(module) if type(node) is ast.ClassDef]

        self.assertEqual(index.class_definitions(module), expected)
        self.assertIs(index.class_definitions(module), index.class_definitions(module))

    def test_records_parent_chain_in_ast_order(self) -> None:
        """Responsibilities: _ordered parent relationship_."""
        module = ast.parse("value = left + right")
        assignment = next(node for node in module.body if type(node) is ast.Assign)
        index = PythonAstNodeIndex()
        index.nodes(module)

        self.assertEqual(
            {"assignment": index.parents(assignment), "expression": index.parents(assignment.value)},
            {"assignment": [module], "expression": [assignment]},
        )

    def test_keeps_all_parents_for_a_shared_node(self) -> None:
        """Responsibilities: _shared AST parent relationships_."""
        shared_name = ast.Name(id="value", ctx=ast.Load())
        first_expression = ast.Expr(value=shared_name)
        second_expression = ast.Expr(value=shared_name)
        module = ast.Module(body=[first_expression, second_expression], type_ignores=[])
        index = PythonAstNodeIndex()
        index.nodes(module)

        self.assertEqual(index.parents(shared_name), [first_expression, second_expression])

    def test_reuses_cached_children_for_repeated_lookups(self) -> None:
        """Responsibilities: _cached direct child reuse_."""
        module = ast.parse("value = left + right")
        index = PythonAstNodeIndex()
        index.nodes(module)
        first_children = index.children(module)
        second_children = index.children(module)

        self.assertIs(second_children, first_children)

    def test_subtree_scope_keeps_the_original_module_owner(self) -> None:
        """Responsibilities: _subtree lexical scope ownership_."""
        module = ast.parse("def run():\n    value = left + right\n")
        assignment = next(node for node in ast.walk(module) if type(node) is ast.Assign)
        index = PythonAstNodeIndex()
        module_scope = index.scopes(module)
        subtree_scope = index.scopes(assignment)

        self.assertNotEqual(module_scope[assignment], "module")
        self.assertEqual(subtree_scope[assignment], module_scope[assignment])
