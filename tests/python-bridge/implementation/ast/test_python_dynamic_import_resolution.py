import unittest

from implementation.ast.python_ast_tree import PythonAstTree


class PythonDynamicImportResolutionTest(unittest.TestCase):
    """Responsibilities: _container import resolution_, _direct dynamic import recognition_."""

    """Responsibilities: _dynamic import behavior_."""

    def test_resolves_import_from_static_container_alias(self) -> None:
        """Responsibilities: _static container alias resolution_."""
        source = "import importlib\ndef load_module():\n    loader = {'load': importlib.import_module}\n    return loader['load']('module')\n"
        tree = PythonAstTree(source)
        issues = tree.import_rules.import_issues(tree.tree)
        self.assertEqual([issue["kind"] for issue in issues if issue["kind"] == "dynamic"], ["dynamic"])

    def test_resolves_import_from_container_attribute_alias(self) -> None:
        """Responsibilities: _container attribute alias resolution_."""
        source = "import importlib\nloaders = {'module': importlib.import_module}\nmodule = loaders.module('example')\n"
        tree = PythonAstTree(source)
        issues = tree.import_rules.import_issues(tree.tree)
        self.assertEqual([issue["kind"] for issue in issues if issue["kind"] == "dynamic"], ["dynamic"])

    def test_resolves_import_from_builtin_mapping_callable(self) -> None:
        """Responsibilities: _builtin mapping callable resolution_."""
        source = "import builtins\nimport importlib\ndef load_module(module_name: str) -> object:\n    resolve = builtins.__dict__['getattr']\n    loader = resolve(importlib, 'import_module')\n    return loader(module_name)\n"
        tree = PythonAstTree(source)
        issues = tree.import_rules.import_issues(tree.tree)
        self.assertEqual([issue["kind"] for issue in issues if issue["kind"] == "dynamic"], ["dynamic"])

    def test_keeps_direct_dynamic_import_recognition(self) -> None:
        """Responsibilities: _direct dynamic import recognition_."""
        source = "import importlib\ndef load_module(module_name: str) -> object:\n    return importlib.import_module(module_name)\n"
        tree = PythonAstTree(source)
        issues = tree.import_rules.import_issues(tree.tree)
        self.assertEqual([issue["kind"] for issue in issues if issue["kind"] == "dynamic"], ["dynamic"])
