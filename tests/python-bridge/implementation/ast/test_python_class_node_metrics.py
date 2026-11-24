import ast
import unittest

from implementation.ast.python_ast_tree import PythonAstTree


class PythonClassNodeMetricsTest(unittest.TestCase):
    """Responsibilities: _decorated class metrics_, _nested documentation metrics_."""

    def test_class_line_metric_excludes_documentation_without_body(self) -> None:
        """Responsibilities: _class line metrics_, _docstring line metrics_."""
        source = '''\
@decorate
class Cache:
    """Class documentation.
    More documentation.
    """
    def load(self):
        """Method documentation.
        More documentation.
        """
        pass
    value = 1
'''

        module = ast.parse(source)
        class_tree = PythonAstTree(source, module)
        class_nodes = class_tree.class_nodes()
        class_metrics = class_nodes[0]

        documented_source = 'class Empty:\n    """Documentation only."""\n'
        documented_module = ast.parse(documented_source)
        documented_tree = PythonAstTree(documented_source, documented_module)
        documented_nodes = documented_tree.class_nodes()
        documented_metrics = documented_nodes[0]

        self.assertEqual(
            (class_metrics["lines"], documented_metrics["lines"]),
            (5, 0),
        )

    def test_class_line_metric_counts_executable_body_lines(self) -> None:
        """Responsibilities: _executable class line metrics_."""
        source = '''\
class Cache:
    """Class documentation.
    Multiple lines are excluded.
    """
    first = 1
    second = 2
'''
        module = ast.parse(source)
        class_tree = PythonAstTree(source, module)
        class_nodes = class_tree.class_nodes()
        class_metrics = class_nodes[0]

        self.assertEqual(class_metrics["lines"], 2)
