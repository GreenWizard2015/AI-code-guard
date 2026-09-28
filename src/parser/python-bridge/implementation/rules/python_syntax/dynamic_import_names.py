from __future__ import annotations


import ast

from implementation.references.aliases.container_aliases import PythonContainerAliases
from implementation.references.aliases.reference_aliases import PythonReferenceAliases
from implementation.rules.python_syntax.dynamic_import_references import PythonDynamicImportReferences


class PythonDynamicImportNames:
    """Responsibilities: _dynamic import name resolution_."""

    def _local_name(self, imported: ast.alias) -> str:
        """Responsibilities: _resolution imported local name_."""
        if imported.asname is not None:
            return imported.asname
        return imported.name.split(".")[0]

    def _configure_module_import(self, node: ast.Import) -> None:
        """Responsibilities: _configuration dynamic import modules_."""
        for imported in node.names:
            if imported.name == "importlib":
                self.module_aliases[self._local_name(imported)] = "importlib"
            if imported.name == "builtins":
                self.builtin_module_aliases.add(self._local_name(imported))

    def _configure_function_import(self, node: ast.ImportFrom) -> None:
        """Responsibilities: _configuration dynamic import functions_."""
        if node.module == "importlib":
            for imported in node.names:
                if imported.name == "import_module":
                    self.function_aliases[self._local_name(imported)] = "import_module"
        if node.module == "builtins":
            for imported in node.names:
                if imported.name in {"__import__", "getattr"}:
                    self.function_aliases[self._local_name(imported)] = imported.name

    def _configure_assignment(self, node: ast.AST) -> None:
        """Responsibilities: _configuration assigned dynamic aliases_."""
        if type(node) is ast.Assign:
            self._configure_assignment_targets(node.targets, node.value)
            return
        if type(node) is not ast.AnnAssign:
            return
        if node.value is None:
            return
        self._configure_assignment_targets([node.target], node.value)

    def _configure_container_target(self, target: ast.AST, value: ast.AST) -> None:
        """Responsibilities: _configuration container alias target_."""
        if type(target) is not ast.Name:
            return
        self.module_aliases.pop(target.id, None)
        self.function_aliases.pop(target.id, None)

    def _configure_assignment_targets(self, targets: list[ast.AST], value: ast.AST) -> None:
        """Responsibilities: _configuration dynamic alias targets_."""
        target_values: dict[str, ast.AST] = {}
        for target in targets:
            self._configure_container_target(target, value)
            target_values.update(
                self.assignment_aliases.target_values(target, value, references_only=False)
            )
        self.container_aliases.assign(targets, value)
        for target, source in target_values.items():
            reference = self.references.reference(source, set())
            if reference.kind_value() == "module":
                self.module_aliases[target] = reference.name_value()
            if reference.kind_value() == "function":
                self.function_aliases[target] = reference.name_value()

    def __init__(self) -> None:
        """Responsibilities: _initialization dynamic import aliases_."""
        self.module_aliases: dict[str, str] = {}
        self.builtin_module_aliases: set[str] = set()
        self.container_aliases: PythonContainerAliases = PythonContainerAliases()
        self.function_aliases: dict[str, str] = {
            "__import__": "__import__",
            "getattr": "getattr",
        }
        self.assignment_aliases: PythonReferenceAliases = PythonReferenceAliases()
        self.references: PythonDynamicImportReferences = PythonDynamicImportReferences(
            self.module_aliases,
            self.builtin_module_aliases,
            self.function_aliases,
            self.container_aliases.values,
        )

    def configure(self, tree: ast.AST) -> None:
        """Responsibilities: _configuration dynamic import aliases_."""
        self.module_aliases.clear()
        self.builtin_module_aliases.clear()
        self.container_aliases.clear()
        self.function_aliases.clear()
        self.function_aliases["__import__"] = "__import__"
        self.function_aliases["getattr"] = "getattr"
        if type(tree) is not ast.Module:
            return
        for node in tree.body:
            self.observe(node)

    def observe(self, node: ast.AST) -> None:
        """Responsibilities: _observation dynamic import aliases_."""
        if type(node) is ast.Import:
            self._configure_module_import(node)
        if type(node) is ast.ImportFrom:
            self._configure_function_import(node)
        self._configure_assignment(node)

    def matches(self, function: ast.AST) -> bool:
        """Responsibilities: _classification dynamic import function_."""
        reference = self.references.reference(function, set())
        if reference.kind_value() != "function":
            return False
        return reference.name_value() in {"import_module", "__import__"}
