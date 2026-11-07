from __future__ import annotations

import ast
import unittest

from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.type_declarations.annotation_names import AnnotationNames
from implementation.references.call_returns import CallReturns
from implementation.references.context.python_reference_context_options import (
    PythonReferenceContextOptions,
)
from implementation.references.context.python_reference_symbol_tables import (
    PythonReferenceSymbolTables,
)
from implementation.references.instances.python_instance_collector import (
    PythonInstanceCollector,
)
from implementation.references.python_reference_context import PythonReferenceContext
from python_reference_test_support import PythonReferenceTestSupport


class PythonReferenceBindingOwnershipTest(unittest.TestCase):
    """Responsibilities: _lexical binding ownership_, _collection element ownership_."""

    def __init__(self, method_name: str = "runTest") -> None:
        """Responsibilities: _reference support composition_."""
        super().__init__(method_name)
        self._reference_support: PythonReferenceTestSupport = PythonReferenceTestSupport(self)

    def test_keeps_same_parameter_names_in_separate_function_scopes(self) -> None:
        """Responsibilities: _lexical instance ownership_."""
        source = (
            "def first(model: First):\n"
            "    return model.value\n\n"
            "def second(model: Second):\n"
            "    return model.value\n"
        )
        scenario = self._reference_support.create_scenario(source)
        instance_collector = PythonInstanceCollector(scenario.tree, scenario.context, scenario.node_index)
        instance_collector.collect_instances(scenario.annotation_names)
        instance_collector.collect_for_aliases()
        owners = [
            scenario.context.attribute_owner(node.value, "")
            for node in ast.walk(scenario.tree)
            if type(node) is ast.Attribute and type(node.value) is ast.Name
        ]

        self.assertEqual(owners, ["First", "Second"])

    def test_keeps_collection_receiver_and_element_owners_separate(self) -> None:
        """Responsibilities: _collection receiver ownership verification_."""
        scenario = self._reference_support.create_scenario(
            "class Service:\n    def clear(self):\n        pass\n\n"
            "def run(values: list[Service]):\n"
            "    values.clear()\n"
            "    for value in values:\n"
            "        value.clear()\n",
        )
        instance_collector = PythonInstanceCollector(scenario.tree, scenario.context, scenario.node_index)
        instance_collector.collect_instances(scenario.annotation_names)
        instance_collector.collect_for_aliases()
        calls = self._reference_support.method_calls(scenario.tree)
        owners = [scenario.context.attribute_owner(self._reference_support.call_receiver(call), "") for call in calls]
        self.assertEqual(owners, ["list", "Service"])

    def test_prefers_nearest_parameter_over_outer_instance(self) -> None:
        """Responsibilities: _nearest Python binding verification_."""
        scenario = self._reference_support.create_scenario(
            "client = First()\ndef run(client: Second):\n    client.execute()\n",
        )
        instance_collector = PythonInstanceCollector(scenario.tree, scenario.context, scenario.node_index)
        instance_collector.collect_instances(scenario.annotation_names)
        calls = self._reference_support.method_calls(scenario.tree)
        call = calls[0]
        owner = scenario.context.attribute_owner(self._reference_support.call_receiver(call), "")

        self.assertEqual(owner, "Second")

    def test_resolves_each_receiver_write_at_its_source_position(self) -> None:
        """Responsibilities: _positioned Python binding verification_."""
        scenario = self._reference_support.create_scenario(
            "def run():\n"
            "    client = First()\n"
            "    client.execute()\n"
            "    client = Second()\n"
            "    client.execute()\n"
            "    client = None\n"
            "    client.execute()\n",
        )
        instance_collector = PythonInstanceCollector(scenario.tree, scenario.context, scenario.node_index)
        instance_collector.collect_instances(scenario.annotation_names)
        instance_collector.collect_for_aliases()
        calls = self._reference_support.method_calls(scenario.tree)
        owners = [scenario.context.attribute_owner(self._reference_support.call_receiver(call), "") for call in calls]
        self.assertEqual(owners, ["First", "Second", ""])

    def test_records_each_target_in_chained_assignments(self) -> None:
        """Responsibilities: _chained assignment receiver ownership_."""
        scenario = self._reference_support.create_scenario(
            "class First:\n    def execute(self):\n        pass\n\n"
            "class Second:\n    def execute(self):\n        pass\n\n"
            "def known():\n"
            "    client = First()\n"
            "    client = other = Second()\n"
            "    client.execute()\n"
            "    other.execute()\n\n"
            "def unknown():\n"
            "    client = First()\n"
            "    client = other = None\n"
            "    client.execute()\n",
        )
        instances = PythonInstanceCollector(scenario.tree, scenario.context, scenario.node_index)
        instances.collect_instances(scenario.annotation_names)
        instances.collect_for_aliases()
        calls = self._reference_support.method_calls(scenario.tree)
        calls.sort(key=lambda node: (node.lineno, node.col_offset))
        owners = [scenario.context.attribute_owner(self._reference_support.call_receiver(call), "") for call in calls]

        self.assertEqual(owners, ["Second", "Second", ""])

    def test_records_named_expression_receiver_bindings(self) -> None:
        """Responsibilities: _named expression instance ownership_."""
        scenario = self._reference_support.create_scenario(
            "class Service:\n"
            "    def execute(self):\n"
            "        pass\n\n"
            "def run():\n"
            "    if (service := Service()):\n"
            "        service.execute()\n",
        )
        instances = PythonInstanceCollector(scenario.tree, scenario.context, scenario.node_index)
        instances.collect_instances(scenario.annotation_names)
        calls = self._reference_support.method_calls(scenario.tree)
        call = calls[0]
        owner = scenario.context.attribute_owner(self._reference_support.call_receiver(call), "")

        self.assertEqual(owner, "Service")

    def test_annotation_without_value_preserves_runtime_receiver(self) -> None:
        """Responsibilities: _runtime annotation binding distinction_."""
        scenario = self._reference_support.create_scenario(
            "class First:\n    def execute(self):\n        pass\n\n"
            "class Second:\n    def execute(self):\n        pass\n\n"
            "def run():\n"
            "    client = First()\n"
            "    client: Second\n"
            "    client.execute()\n",
        )
        instances = PythonInstanceCollector(scenario.tree, scenario.context, scenario.node_index)
        instances.collect_instances(scenario.annotation_names)
        instances.collect_for_aliases()
        calls = self._reference_support.method_calls(scenario.tree)
        call = calls[0]
        owner = scenario.context.attribute_owner(self._reference_support.call_receiver(call), "")

        self.assertEqual(owner, "First")

    def test_comprehension_target_shadows_only_inside_its_scope(self) -> None:
        """Responsibilities: _comprehension receiver ownership_."""
        scenario = self._reference_support.create_scenario(
            "class First:\n    def execute(self):\n        pass\n\n"
            "class Second:\n    def execute(self):\n        pass\n\n"
            "def run(client: First, values: list[Second]):\n"
            "    results = [client.execute() for client in values]\n"
            "    client.execute()\n"
            "    return results\n",
        )
        instances = PythonInstanceCollector(scenario.tree, scenario.context, scenario.node_index)
        instances.collect_instances(scenario.annotation_names)
        instances.collect_for_aliases()
        calls = self._reference_support.method_calls(scenario.tree)
        calls.sort(key=lambda node: (node.lineno, node.col_offset))
        owners = [scenario.context.attribute_owner(self._reference_support.call_receiver(call), "") for call in calls]

        self.assertEqual(owners, ["Second", "First"])

    def test_later_assignment_wins_over_previously_collected_loop_binding(self) -> None:
        """Responsibilities: _binding event source order_."""
        scenario = self._reference_support.create_scenario(
            "class First:\n    def execute(self):\n        pass\n\n"
            "class Second:\n    def execute(self):\n        pass\n\n"
            "def run(values: list[First]):\n"
            "    for item in values:\n"
            "        pass\n"
            "    item = Second()\n"
            "    item.execute()\n",
        )
        instances = PythonInstanceCollector(scenario.tree, scenario.context, scenario.node_index)
        instances.collect_instances(scenario.annotation_names)
        instances.collect_for_aliases()
        calls = self._reference_support.method_calls(scenario.tree)
        call = calls[0]
        owner = scenario.context.attribute_owner(self._reference_support.call_receiver(call), "")

        self.assertEqual(owner, "Second")

    def test_does_not_attach_foreign_property_writes_to_the_current_class(self) -> None:
        """Responsibilities: _foreign property ownership verification_."""
        tree = ast.parse(
            "class Holder:\n"
            "    def configure(self, other: Second):\n"
            "        other.service = Second()\n"
            "    def run(self):\n"
            "        self.service.execute()\n",
        )
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)
        properties: dict[str, str] = {}
        context = PythonReferenceContext(
            PythonReferenceContextOptions(
                PythonReferenceSymbolTables({}, {}, properties, {}),
                CallReturns(AnnotationNames(node_index), node_index),
                node_index,
            ),
        )
        annotations = AnnotationNames(node_index)
        instances = PythonInstanceCollector(tree, context, node_index)
        instances.collect_instances(annotations)

        self.assertNotIn("Holder.service", properties)

    def test_resolves_collection_elements_at_each_reaching_write(self) -> None:
        """Responsibilities: _positioned collection element ownership_."""
        scenario = self._reference_support.create_scenario(
            "class First:\n    def execute(self):\n        pass\n\n"
            "class Second:\n    def execute(self):\n        pass\n\n"
            "def run(values: list[First], replacement: list[Second]):\n"
            "    for item in values:\n        item.execute()\n"
            "    values = replacement\n"
            "    for item in values:\n        item.execute()\n",
        )
        instance_collector = PythonInstanceCollector(scenario.tree, scenario.context, scenario.node_index)
        instance_collector.collect_instances(scenario.annotation_names)
        instance_collector.collect_for_aliases()
        calls = self._reference_support.method_calls(scenario.tree)
        owners = [scenario.context.attribute_owner(self._reference_support.call_receiver(call), "") for call in calls]
        self.assertEqual(owners, ["First", "Second"])

    def test_keeps_annotated_collection_receiver_as_container(self) -> None:
        """Responsibilities: _annotated collection receiver ownership_."""
        source = ast.parse(
            "class Service:\n    def clear(self):\n        pass\n\n"
            "def run():\n    values: list[Service] = []\n    values.clear()\n",
        )
        tree = source
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)
        context = PythonReferenceContext(
            PythonReferenceContextOptions(
                PythonReferenceSymbolTables({}, {}, {}, {}),
                CallReturns(AnnotationNames(node_index), node_index),
                node_index,
            ),
        )
        instances = PythonInstanceCollector(tree, context, node_index)
        instances.collect_instances(AnnotationNames(node_index))
        instances.collect_for_aliases()
        calls = self._reference_support.method_calls(tree)
        call = calls[0]
        self.assertEqual(context.attribute_owner(self._reference_support.call_receiver(call), ""), "list")
