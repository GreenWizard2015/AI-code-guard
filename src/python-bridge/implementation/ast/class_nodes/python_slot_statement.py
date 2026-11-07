from __future__ import annotations

import ast

from implementation.rules.constants import PYTHON_SLOTS_ATTRIBUTE


class PythonSlotStatement:
    """Responsibilities: _slot statement classification_, _slot value extraction_."""

    def __init__(self, node: ast.stmt) -> None:
        """Responsibilities: _slot statement initialization_."""
        self._node: ast.stmt = node

    def binding_name(self) -> str:
        """Responsibilities: _slot binding name extraction_."""
        if type(self._node) is ast.Assign and len(self._node.targets) == 1:
            target = self._node.targets[0]
            if type(target) is ast.Name:
                return target.id
        if type(self._node) is ast.AnnAssign and type(self._node.target) is ast.Name:
            return self._node.target.id
        return ""

    def binding_value(self) -> ast.expr:
        """Responsibilities: _slot binding expression extraction_."""
        if type(self._node) is ast.Assign and len(self._node.targets) == 1:
            return self._node.value
        if type(self._node) is ast.AnnAssign and self._node.value is not None:
            return self._node.value
        return ast.Constant(value=None)

    def slot_value(self) -> ast.expr:
        """Responsibilities: _slot declaration extraction_."""
        if type(self._node) is ast.Assign:
            for target in self._node.targets:
                if type(target) is ast.Name and target.id == PYTHON_SLOTS_ATTRIBUTE:
                    return self._node.value
        if type(self._node) is ast.AnnAssign and type(self._node.target) is ast.Name:
            if self._node.target.id == PYTHON_SLOTS_ATTRIBUTE:
                return self.binding_value()
        return ast.Constant(value=None)

    def metadata(self) -> bool:
        """Responsibilities: _slot metadata classification_."""
        if type(self._node) is ast.Assign:
            for target in self._node.targets:
                if type(target) is ast.Name and target.id == PYTHON_SLOTS_ATTRIBUTE:
                    return True
        if type(self._node) is ast.AnnAssign and type(self._node.target) is ast.Name:
            return self._node.target.id == PYTHON_SLOTS_ATTRIBUTE
        return False
