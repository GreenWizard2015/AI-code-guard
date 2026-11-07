from __future__ import annotations

import ast
import unittest

from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.type_declarations.annotation_names import AnnotationNames
from implementation.references.call_returns import CallReturns
from implementation.references.instances.python_instance_collector import (
    PythonInstanceCollector,
)
from implementation.references.python_call_assignment import PythonCallAssignment
from implementation.references.python_call_binding import PythonCallBinding
from implementation.references.python_call_reference_options import (
    PythonCallReferenceOptions,
)
from implementation.references.python_reference import PythonReference
from python_reference_test_support import PythonReferenceTestSupport


class PythonReferenceCallOwnershipTest(unittest.TestCase):
    """Responsibilities: _call binding ownership_, _return type ownership_."""

    def __init__(self, method_name: str = "runTest") -> None:
        """Responsibilities: _reference support composition_."""
        super().__init__(method_name)
        self._reference_support: PythonReferenceTestSupport = PythonReferenceTestSupport(self)

    def test_resolves_call_assignment_names_and_annotations(self) -> None:
        """Responsibilities: _call binding metadata results_."""
        tree = ast.parse(
            "plain = create()\nnamed: Package.Result = create()\nqualified: Result = create()\n",
        )
        index = PythonAstNodeIndex()
        index.nodes(tree)
        calls = [node for node in ast.walk(tree) if type(node) is ast.Call]
        bindings = [PythonCallAssignment(call, index) for call in calls]

        self.assertEqual(
            [(binding.target_name(), binding.annotation_name()) for binding in bindings],
            [("plain", ""), ("named", "Result"), ("qualified", "Result")],
        )

    def test_ignores_calls_without_a_direct_assignment_target(self) -> None:
        """Responsibilities: _unbound call metadata results_."""
        tree = ast.parse(
            "def run():\n    create()\n    return create()\n    left, right = create()\n",
        )
        index = PythonAstNodeIndex()
        index.nodes(tree)
        calls = [node for node in ast.walk(tree) if type(node) is ast.Call]
        bindings = [PythonCallAssignment(call, index) for call in calls]

        self.assertEqual(
            [(binding.target_name(), binding.annotation_name()) for binding in bindings],
            [("", ""), ("", ""), ("", "")],
        )

    def test_default_call_return_state_is_owned_by_collector(self) -> None:
        """Responsibilities: _default call return ownership_."""
        tree = ast.parse("def run():\n    pass\n")
        index = PythonAstNodeIndex()
        index.nodes(tree)
        return_collector = CallReturns(AnnotationNames(index), index)
        return_state = return_collector.return_state()
        return_state.store("make", "Service")
        stored_owner = return_state.value("make")
        return_state.state_cleanup()
        owner_after_cleanup = return_collector.value("make")
        self.assertEqual([stored_owner, owner_after_cleanup], ["Service", ""])

    def test_uses_one_return_owner_for_assigned_and_inline_factories(self) -> None:
        """Responsibilities: _factory owner resolution_."""
        scenario = self._reference_support.create_scenario(
            "class Service:\n    def execute(self):\n        pass\n\n"
            "def make() -> Service:\n    return Service()\n\n"
            "def run():\n    assigned = make()\n    assigned.execute()\n    make().execute()\n",
        )
        return_collector = scenario.return_state
        return_collector.collect_call_returns(scenario.tree, scenario.context)
        instance_collector = PythonInstanceCollector(scenario.tree, scenario.context, scenario.node_index)
        instance_collector.collect_instances(scenario.annotation_names)
        instance_collector.collect_for_aliases()
        calls = self._reference_support.method_calls(scenario.tree)
        owners = [scenario.context.attribute_owner(self._reference_support.call_receiver(call), "") for call in calls]
        self.assertEqual(owners, ["Service", "Service"])

    def test_resolves_property_reassignment_at_each_source_position(self) -> None:
        """Responsibilities: _positioned property ownership_."""
        scenario = self._reference_support.create_scenario(
            "class First:\n    def execute(self):\n        pass\n\n"
            "class Second:\n    def execute(self):\n        pass\n\n"
            "class Holder:\n    def run(self):\n"
            "        self.service = First()\n        self.service.execute()\n"
            "        self.service = Second()\n        self.service.execute()\n",
        )
        instance_collector = PythonInstanceCollector(scenario.tree, scenario.context, scenario.node_index)
        instance_collector.collect_instances(scenario.annotation_names)
        instance_collector.collect_for_aliases()
        calls = self._reference_support.method_calls(scenario.tree)
        owners = [
            scenario.context.attribute_owner(self._reference_support.call_receiver(call), "Holder") for call in calls
        ]
        self.assertEqual(owners, ["First", "Second"])

    def test_resolves_static_and_nested_receiver_parameters_explicitly(self) -> None:
        """Responsibilities: _explicit Python receiver ownership_."""
        scenario = self._reference_support.create_scenario(
            "class Other:\n    def execute(self):\n        pass\n\n"
            "class Holder:\n"
            "    @staticmethod\n    def static(self: Other):\n        self.execute()\n"
            "    def run(self):\n        def inner(self: Other):\n            self.execute()\n"
            "        inner(Other())\n",
        )
        instance_collector = PythonInstanceCollector(scenario.tree, scenario.context, scenario.node_index)
        instance_collector.collect_instances(scenario.annotation_names)
        instance_collector.collect_for_aliases()
        calls = self._reference_support.method_calls(scenario.tree)
        owners = [
            scenario.context.attribute_owner(self._reference_support.call_receiver(call), "Holder") for call in calls
        ]
        self.assertEqual(owners, ["Other", "Other"])

    def test_keeps_nested_factory_return_identity_lexically_bound(self) -> None:
        """Responsibilities: _lexical factory identity verification_."""
        scenario = self._reference_support.create_scenario(self._nested_factory_source())
        return_collector = scenario.return_state
        return_collector.collect_call_returns(scenario.tree, scenario.context)
        instance_collector = PythonInstanceCollector(scenario.tree, scenario.context, scenario.node_index)
        instance_collector.collect_instances(scenario.annotation_names)
        calls = self._reference_support.method_calls(scenario.tree)
        owners = [scenario.context.attribute_owner(self._reference_support.call_receiver(call), "") for call in calls]
        self.assertEqual(owners, ["First"])

    def _nested_factory_source(self) -> str:
        """Responsibilities: _nested factory identity source_."""
        return (
            "def make() -> First:\n"
            "    return First()\n"
            "\n"
            "def run():\n"
            "    client = make()\n"
            "    client.execute()\n"
            "\n"
            "def unrelated():\n"
            "    def make() -> Second:\n"
            "        return Second()\n"
        )

    def test_builds_reference_records(self) -> None:
        """Responsibilities: _reference records verification_."""
        scenario = self._reference_support.create_scenario("def run():\n    pass\n")
        reference = PythonReference(scenario.context)
        function_call = self._reference_support.call_expression("run()")
        function_options = PythonCallReferenceOptions(
            function_call,
            "Service",
            PythonCallBinding("", "", is_deferred=False),
        )
        function_reference = reference.for_call(function_options)
        method_call = self._reference_support.call_expression("service.run()")
        method_options = PythonCallReferenceOptions(
            method_call,
            "Service",
            PythonCallBinding("", "", is_deferred=False),
        )
        method_reference = reference.for_call(method_options)
        field_reference = reference.for_expression(ast.parse("handler.bind", mode="eval").body, "Service")
        self.assertEqual(
            [
                function_reference["kind"],
                method_reference["is_call"],
                field_reference["name"],
            ],
            ["function", True, "bind"],
        )
