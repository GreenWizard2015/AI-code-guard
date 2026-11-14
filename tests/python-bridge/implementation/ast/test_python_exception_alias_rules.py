import unittest

from constants import BUILTINS_DICTIONARY_SOURCE
from implementation.ast.python_ast_tree import PythonAstTree


class PythonExceptionAliasRulesTest(unittest.TestCase):
    """Responsibilities: _exception-handler forms_, _dynamic-type contexts_."""

    def test_collects_error_context_suppression_through_none_alias(self) -> None:
        """Responsibilities: _aliased exception cause diagnostics_."""
        source = (
            "try:\n"
            "    int('invalid')\n"
            "except ValueError:\n"
            "    cause = None\n"
            "    alias = cause\n"
            "    raise RuntimeError('invalid input') from alias\n"
        )
        collector = PythonAstTree(source)
        self.assertEqual(
            [issue["kind"] for issue in collector.coding_issues() if issue["kind"] == "error-context-loss"],
            ["error-context-loss"],
        )

    def test_ignores_none_alias_overwritten_with_an_exception(self) -> None:
        """Responsibilities: _overwritten exception cause filtering_."""
        source = (
            "try:\n"
            "    int('invalid')\n"
            "except ValueError as error:\n"
            "    cause = None\n"
            "    cause = error\n"
            "    raise RuntimeError('invalid input') from cause\n"
        )
        collector = PythonAstTree(source)
        self.assertEqual(
            [issue["kind"] for issue in collector.coding_issues() if issue["kind"] == "error-context-loss"],
            [],
        )

    def test_collects_direct_converted_broad_exception(self) -> None:
        """Responsibilities: _exception alias_."""
        source = "try:\n    run()\nexcept tuple([Exception]):\n    pass\n"
        collector = PythonAstTree(source)
        self.assertIn("broad-except", [issue["kind"] for issue in collector.coding_issues()])

    def test_collects_dynamic_type_in_with_context(self) -> None:
        """Responsibilities: _context dynamic type_."""
        source = (
            "from contextlib import nullcontext\n"
            'with type("Session", (nullcontext,), {})("value") as session:\n'
            "    str(session)\n"
        )
        collector = PythonAstTree(source)
        self.assertIn("dynamic-type", [issue["kind"] for issue in collector.coding_issues()])

    def test_collects_dynamic_type_in_every_with_context(self) -> None:
        """Responsibilities: _all context dynamic types_."""
        source = (
            "from contextlib import nullcontext\n"
            'with nullcontext(), type("Session", (), {})("value"):\n'
            "    pass\n"
        )
        collector = PythonAstTree(source)
        self.assertEqual(
            [issue["kind"] for issue in collector.coding_issues() if issue["kind"] == "dynamic-type"],
            ["dynamic-type"],
        )

    def test_collects_dynamic_type_in_class_bases(self) -> None:
        """Responsibilities: _class base dynamic type_."""
        source = 'class Record(type("RecordBase", (), {})):\n'
        source += "    pass\n"
        collector = PythonAstTree(source)
        self.assertIn(
            "dynamic-type",
            [issue["kind"] for issue in collector.coding_issues()],
        )

    def test_collects_broad_except_star(self) -> None:
        """Responsibilities: _broad except-star_."""
        source = "try:\n    raise Exception()\nexcept* Exception:\n    pass\n"
        collector = PythonAstTree(source)
        self.assertEqual(
            [issue["kind"] for issue in collector.coding_issues() if issue["kind"] == "broad-except"],
            ["broad-except"],
        )

    def test_accepts_broad_exception_when_bound_error_is_used(self) -> None:
        """Responsibilities: _exception binding usage_."""
        source = (
            "try:\n"
            "    run()\n"
            "except Exception as error:\n"
            "    logger.error('operation failed: %s', error)\n"
            "try:\n"
            "    run()\n"
            "except Exception as cause:\n"
            "    raise RuntimeError('operation failed') from cause\n"
            "try:\n"
            "    run()\n"
            "except Exception as unused:\n"
            "    pass\n"
        )
        collector = PythonAstTree(source)
        issues = [issue for issue in collector.coding_issues() if issue["kind"] == "broad-except"]

        self.assertEqual([issue["line"] for issue in issues], [10])

    def test_collects_starred_exception_alias(self) -> None:
        """Responsibilities: _starred exception tuple_."""
        source = (
            "exceptions = (ValueError, TypeError)\n"
            "try:\n"
            "    raise ValueError()\n"
            "except (*exceptions,):\n"
            "    pass\n"
        )
        collector = PythonAstTree(source)
        self.assertTrue(any(issue["kind"] == "python-multi-except" for issue in collector.coding_issues()))

    def test_list_exception_handlers(self) -> None:
        """Responsibilities: _exception handlers_."""
        source = (
            "try:\n"
            "    run()\n"
            "except tuple([ValueError, TypeError]):\n"
            "    pass\n"
            "errors = [ValueError, TypeError]\n"
            "try:\n"
            "    run()\n"
            "except (*errors,):\n"
            "    pass\n"
        )
        collector = PythonAstTree(source)
        self.assertEqual(
            [issue["kind"] for issue in collector.coding_issues() if issue["kind"] == "python-multi-except"],
            ["python-multi-except", "python-multi-except"],
        )

    def test_collects_sliced_exception_tuple_alias(self) -> None:
        """Responsibilities: _sliced exception sequence coverage_."""
        source = "errors = (ValueError, TypeError)\ntry:\n    run()\nexcept errors[:]:\n    pass\n"
        collector = PythonAstTree(source)
        self.assertIn(
            "python-multi-except",
            [issue["kind"] for issue in collector.coding_issues()],
        )

    def test_collects_exception_assignment_alias(self) -> None:
        """Responsibilities: _exception alias coverage_."""
        source = (
            "ExceptionAlias = Exception\n"
            "try:\n"
            "    value = 1\n"
            "except ExceptionAlias:\n"
            "    value = 2\n"
            "\n"
            "multi_exception, ignored = ((ValueError, TypeError), None)\n"
            "try:\n"
            "    value = 3\n"
            "except multi_exception:\n"
            "    value = 4\n"
            "\n"
            "import builtins as bi\n"
            "builtins_alias = bi\n"
            "try:\n"
            "    value = 3\n"
            "except builtins_alias.Exception:\n"
            "    value = 4\n"
        )
        collector = PythonAstTree(source)
        kinds = {issue["kind"] for issue in collector.coding_issues()}
        self.assertIn("broad-except", kinds)

    def test_tracks_exception_aliases_after_non_mutating_nodes(self) -> None:
        """Responsibilities: _exception alias dispatch filtering_."""
        source = (
            "if True:\n"
            "    marker = 1\n"
            "from builtins import Exception as BroadError\n"
            "def inspect():\n"
            "    alias = BroadError\n"
            "    try:\n"
            "        run()\n"
            "    except alias:\n"
            "        pass\n"
        )
        collector = PythonAstTree(source)

        self.assertEqual(
            [issue["kind"] for issue in collector.coding_issues() if issue["kind"] == "broad-except"],
            ["broad-except"],
        )

    def test_collects_destructured_broad_exception_alias(self) -> None:
        """Responsibilities: _broad exception alias coverage_."""
        source = (
            "import builtins\n"
            "try:\n"
            "    raise ValueError\n"
            "except builtins.Exception:\n"
            "    pass\n"
            "exception_type, ignored = (builtins.Exception, None)\n"
            "try:\n"
            "    raise ValueError\n"
            "except exception_type:\n"
            "    pass\n"
        )
        collector = PythonAstTree(source)
        broad_issues = [issue for issue in collector.coding_issues() if issue["kind"] == "broad-except"]
        self.assertEqual(len(broad_issues), 2)

    def test_collects_builtins_dictionary_aliases(self) -> None:
        """Responsibilities: _builtins dictionary alias coverage_."""
        collector = PythonAstTree(BUILTINS_DICTIONARY_SOURCE)
        kinds = [issue["kind"] for issue in collector.coding_issues()]
        self.assertEqual(
            {
                "broad": kinds.count("broad-except"),
                "instance": kinds.count("python-isinstance"),
                "static": kinds.count("python-static-method"),
            },
            {"broad": 1, "instance": 1, "static": 1},
        )
