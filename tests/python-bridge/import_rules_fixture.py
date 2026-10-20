from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.imports.python_sys_path_rules import PythonSysPathRules
from implementation.references.aliases.python_container_aliases import (
    PythonContainerAliases,
)
from implementation.rules.import_rules import ImportRules
from implementation.rules.python_syntax.dynamic_import_names import (
    PythonDynamicImportNames,
    PythonDynamicImportNamesOptions,
)
from implementation.rules.python_syntax.python_dynamic_import_references import (
    PythonDynamicImportReferences,
)


class ImportRulesFixture:
    """Responsibilities: _import aliases_, _rule inputs_."""

    """Responsibilities: _import rule test dependencies_."""

    def dynamic_names(self, aliases: PythonContainerAliases) -> PythonDynamicImportNames:
        """Responsibilities: _dynamic import test rules_."""
        module_aliases: dict[str, str] = {}
        builtin_module_aliases: set[str] = set()
        function_aliases = {"__import__": "__import__", "getattr": "getattr"}
        references = PythonDynamicImportReferences(
            module_aliases,
            builtin_module_aliases,
            function_aliases,
            aliases.container_values,
        )
        return PythonDynamicImportNames(
            PythonDynamicImportNamesOptions(
                aliases,
                references,
                module_aliases,
                builtin_module_aliases,
                function_aliases,
            )
        )

    def rules(self, aliases: PythonContainerAliases) -> ImportRules:
        """Responsibilities: _import rules fixture_."""
        node_index = PythonAstNodeIndex()
        return ImportRules(
            aliases,
            self.dynamic_names(aliases),
            PythonSysPathRules(aliases, node_index),
            node_index,
        )
