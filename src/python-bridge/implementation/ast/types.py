from __future__ import annotations

import ast
from typing import TypeAlias

from implementation.protocols import (
    PythonAstNodeIndexContract,
    PythonStructureIssuesContract,
)
from implementation.references.aliases.protocols import (
    PythonContainerAliasesContract,
    PythonReferenceAliasesContract,
)

PythonAstImportStateOptionValue: TypeAlias = (
    ast.Module
    | PythonAstNodeIndexContract
    | PythonContainerAliasesContract
    | PythonReferenceAliasesContract
    | PythonStructureIssuesContract
)
