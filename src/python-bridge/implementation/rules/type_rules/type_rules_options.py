from __future__ import annotations

import ast
from dataclasses import dataclass

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.protocols import (
    PythonTupleTypeNamesContract,
    PythonTypeFactoryNamesContract,
)
from implementation.rules.protocols import (
    PythonDecoratorAliasStateContract,
    PythonDecoratorRuleContract,
)


@dataclass(frozen=True)
class TypeRulesOptions:
    """Responsibilities: _type rule dependencies_."""

    tree: ast.AST
    node_index: PythonAstNodeIndexContract
    decorator_rules: PythonDecoratorRuleContract
    decorator_aliases: PythonDecoratorAliasStateContract
    type_factory_names: PythonTypeFactoryNamesContract
    tuple_type_names: PythonTupleTypeNamesContract
