import ast
import unittest

from implementation.ast.callables.callable_statements import CallableStatements
from implementation.ast.class_nodes.python_class_node_details import PythonClassNodeDetails
from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex


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
        declaration = module.body[0]
        if type(declaration) is not ast.ClassDef:
            self.fail("expected decorated class declaration")
        class_node = PythonClassNodeDetails(
            declaration,
            PythonAstNodeIndex(),
            CallableStatements(),
        )
        class_metrics = class_node.metadata([])

        documented_module = ast.parse('class Empty:\n    """Documentation only."""\n')
        documented_declaration = documented_module.body[0]
        if type(documented_declaration) is not ast.ClassDef:
            self.fail("expected docstring-only class declaration")
        documented_class = PythonClassNodeDetails(
            documented_declaration,
            PythonAstNodeIndex(),
            CallableStatements(),
        )
        documented_metrics = documented_class.metadata([])

        self.assertEqual(
            (class_metrics["lines"], documented_metrics["lines"]),
            (5, 0),
        )

    def test_class_line_metric_counts_executable_body_lines(self) -> None:
        """Responsibilities: _executable class line metrics_."""
        module = ast.parse(
            '''\
class Cache:
    """Class documentation.
    Multiple lines are excluded.
    """
    first = 1
    second = 2
''',
        )
        declaration = module.body[0]
        if type(declaration) is not ast.ClassDef:
            self.fail("expected class declaration")
        class_node = PythonClassNodeDetails(
            declaration,
            PythonAstNodeIndex(),
            CallableStatements(),
        )
        class_metrics = class_node.metadata([])

        self.assertEqual(class_metrics["lines"], 2)
