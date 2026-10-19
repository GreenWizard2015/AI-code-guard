from __future__ import annotations

from dataclasses import dataclass

from implementation.protocols import PythonSysPathRulesContract
from implementation.references.aliases.protocols import PythonContainerAliasesContract
from implementation.rules.python_syntax.protocols import (
    PythonDynamicImportNamesContract,
)


@dataclass(frozen=True)
class PythonImportConfiguration:
    """Responsibilities: _Python import rule configuration_."""

    container_aliases: PythonContainerAliasesContract
    dynamic_names: PythonDynamicImportNamesContract
    path_rules: PythonSysPathRulesContract
