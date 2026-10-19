from __future__ import annotations

import ast
import unittest

from implementation.ast.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.type_declarations.annotation_names import AnnotationNames
from implementation.references.call_returns import CallReturns
from implementation.references.instances.python_instance_collector import (
    PythonInstanceCollector,
)
from implementation.references.instances.python_property_type import PythonPropertyType
from implementation.references.instances.python_property_type_collector import (
    PythonPropertyTypeCollector,
)
from implementation.references.python_call_return_state_adapter import (
    PythonCallReturnStateAdapter,
)
from implementation.references.python_reference import PythonReference
from implementation.references.python_reference_context import (
    PythonReferenceContext,
)
from implementation.references.context.python_reference_context_options import PythonReferenceContextOptions
from implementation.references.context.python_reference_symbol_tables import PythonReferenceSymbolTables


class PythonReferenceScenario:
    """Responsibilities: _AST source_, _symbol ownership_."""

    tree: ast.Module
    node_index: PythonAstNodeIndex
    return_state: PythonCallReturnStateAdapter
    context: PythonReferenceContext
    annotation_names: AnnotationNames

    def __init__(
        self,
        tree: ast.Module,
        node_index: PythonAstNodeIndex,
        return_state: PythonCallReturnStateAdapter,
        context: PythonReferenceContext,
        annotation_names: AnnotationNames,
    ) -> None:
        """Responsibilities: _reference scenario state assignment_."""
        self.tree: ast.Module = tree
        self.node_index: PythonAstNodeIndex = node_index
        self.return_state: PythonCallReturnStateAdapter = return_state
        self.context: PythonReferenceContext = context
        self.annotation_names: AnnotationNames = annotation_names


class PythonReferenceScenarioFactory:
    """Responsibilities: _reference scenario parsing_, _component graph assembly_."""

    def create(self, source: str) -> PythonReferenceScenario:
        """Responsibilities: _reference scenario assembly_."""
        tree = ast.parse(source)
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)
        aliases: dict[str, str] = {}
        instances: dict[str, str] = {}
        properties: dict[str, str] = {}
        return_state = PythonCallReturnStateAdapter({})
        options = PythonReferenceContextOptions(
            PythonReferenceSymbolTables(aliases, instances, properties, {}), return_state, node_index
        )
        context = PythonReferenceContext(options)
        return PythonReferenceScenario(
            tree, node_index, return_state, context, AnnotationNames()
        )


class PythonReferenceComponentsTest(unittest.TestCase):
    """Responsibilities: _reference resolution checks_, _scope ownership checks_."""

    def _python_ast_node_index(self) -> PythonAstNodeIndex:
        """Responsibilities: _AST index creation_."""
        return PythonAstNodeIndex()

    def test_tracks_properties(self) -> None:
        """Responsibilities: _property tracking verification_."""
        source = ast.parse("class Service:\n    current: Alias\n    model: Model\n")
        names = AnnotationNames()
        index = PythonAstNodeIndex()
        index.nodes(source)
        property_types = PythonPropertyType(
            {"Alias": "Model"}, {"Service", "Alias"}, names
        )
        collector = PythonPropertyTypeCollector(source, property_types, index)
        properties = collector.collect_properties()
        self.assertEqual(
            {
                "current": properties["Service.current"],
                "model": properties["Service.model"],
            },
            {"current": "Model", "model": "Model"},
        )

    def test_keeps_same_parameter_names_in_separate_function_scopes(self) -> None:
        """Responsibilities: _lexical instance ownership_."""
        source = (
            "def first(model: First):\n"
            "    return model.value\n\n"
            "def second(model: Second):\n"
            "    return model.value\n"
        )
        factory = PythonReferenceScenarioFactory()
        scenario = factory.create(source)
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
        factory = PythonReferenceScenarioFactory()
        scenario = factory.create(
            "class Service:\n    def clear(self):\n        pass\n\n"
            "def run(values: list[Service]):\n"
            "    values.clear()\n"
            "    for value in values:\n"
            "        value.clear()\n"
        )
        instance_collector = PythonInstanceCollector(scenario.tree, scenario.context, scenario.node_index)
        instance_collector.collect_instances(scenario.annotation_names)
        instance_collector.collect_for_aliases()
        calls = [
            node
            for node in ast.walk(scenario.tree)
            if type(node) is ast.Call and type(node.func) is ast.Attribute
        ]
        owners = [
            scenario.context.attribute_owner(call.func.value, "") for call in calls
        ]
        self.assertEqual(owners, ["list", "Service"])

    def test_prefers_nearest_parameter_over_outer_instance(self) -> None:
        """Responsibilities: _nearest Python binding verification_."""
        factory = PythonReferenceScenarioFactory()
        scenario = factory.create(
            "client = First()\ndef run(client: Second):\n    client.execute()\n"
        )
        instance_collector = PythonInstanceCollector(scenario.tree, scenario.context, scenario.node_index)
        instance_collector.collect_instances(scenario.annotation_names)
        call = next(
            node
            for node in ast.walk(scenario.tree)
            if type(node) is ast.Call and type(node.func) is ast.Attribute
        )
        owner = scenario.context.attribute_owner(call.func.value, "")

        self.assertEqual(owner, "Second")

    def test_resolves_each_receiver_write_at_its_source_position(self) -> None:
        """Responsibilities: _positioned Python binding verification_."""
        factory = PythonReferenceScenarioFactory()
        scenario = factory.create(
            "def run():\n"
            "    client = First()\n"
            "    client.execute()\n"
            "    client = Second()\n"
            "    client.execute()\n"
            "    client = None\n"
            "    client.execute()\n"
        )
        instance_collector = PythonInstanceCollector(scenario.tree, scenario.context, scenario.node_index)
        instance_collector.collect_instances(scenario.annotation_names)
        instance_collector.collect_for_aliases()
        calls = [
            node
            for node in ast.walk(scenario.tree)
            if type(node) is ast.Call and type(node.func) is ast.Attribute
        ]
        owners = [
            scenario.context.attribute_owner(call.func.value, "") for call in calls
        ]
        self.assertEqual(owners, ["First", "Second", ""])

    def test_records_each_target_in_chained_assignments(self) -> None:
        """Responsibilities: _chained assignment receiver ownership_."""
        factory = PythonReferenceScenarioFactory()
        scenario = factory.create(
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
            "    client.execute()\n"
        )
        instances = PythonInstanceCollector(scenario.tree, scenario.context, scenario.node_index)
        instances.collect_instances(scenario.annotation_names)
        instances.collect_for_aliases()
        calls = [
            node
            for node in ast.walk(scenario.tree)
            if type(node) is ast.Call and type(node.func) is ast.Attribute
        ]
        calls.sort(key=lambda node: (node.lineno, node.col_offset))
        owners = [
            scenario.context.attribute_owner(call.func.value, "") for call in calls
        ]

        self.assertEqual(owners, ["Second", "Second", ""])

    def test_annotation_without_value_preserves_runtime_receiver(self) -> None:
        """Responsibilities: _runtime annotation binding distinction_."""
        factory = PythonReferenceScenarioFactory()
        scenario = factory.create(
            "class First:\n    def execute(self):\n        pass\n\n"
            "class Second:\n    def execute(self):\n        pass\n\n"
            "def run():\n"
            "    client = First()\n"
            "    client: Second\n"
            "    client.execute()\n"
        )
        instances = PythonInstanceCollector(scenario.tree, scenario.context, scenario.node_index)
        instances.collect_instances(scenario.annotation_names)
        instances.collect_for_aliases()
        call = next(
            node
            for node in ast.walk(scenario.tree)
            if type(node) is ast.Call and type(node.func) is ast.Attribute
        )
        owner = scenario.context.attribute_owner(call.func.value, "")

        self.assertEqual(owner, "First")

    def test_comprehension_target_shadows_only_inside_its_scope(self) -> None:
        """Responsibilities: _comprehension receiver ownership_."""
        factory = PythonReferenceScenarioFactory()
        scenario = factory.create(
            "class First:\n    def execute(self):\n        pass\n\n"
            "class Second:\n    def execute(self):\n        pass\n\n"
            "def run(client: First, values: list[Second]):\n"
            "    results = [client.execute() for client in values]\n"
            "    client.execute()\n"
            "    return results\n"
        )
        instances = PythonInstanceCollector(scenario.tree, scenario.context, scenario.node_index)
        instances.collect_instances(scenario.annotation_names)
        instances.collect_for_aliases()
        calls = [
            node
            for node in ast.walk(scenario.tree)
            if type(node) is ast.Call and type(node.func) is ast.Attribute
        ]
        calls.sort(key=lambda node: (node.lineno, node.col_offset))
        owners = [
            scenario.context.attribute_owner(call.func.value, "") for call in calls
        ]

        self.assertEqual(owners, ["Second", "First"])

    def test_later_assignment_wins_over_previously_collected_loop_binding(self) -> None:
        """Responsibilities: _binding event source order_."""
        factory = PythonReferenceScenarioFactory()
        scenario = factory.create(
            "class First:\n    def execute(self):\n        pass\n\n"
            "class Second:\n    def execute(self):\n        pass\n\n"
            "def run(values: list[First]):\n"
            "    for item in values:\n"
            "        pass\n"
            "    item = Second()\n"
            "    item.execute()\n"
        )
        instances = PythonInstanceCollector(scenario.tree, scenario.context, scenario.node_index)
        instances.collect_instances(scenario.annotation_names)
        instances.collect_for_aliases()
        call = next(
            node
            for node in ast.walk(scenario.tree)
            if type(node) is ast.Call and type(node.func) is ast.Attribute
        )
        owner = scenario.context.attribute_owner(call.func.value, "")

        self.assertEqual(owner, "Second")

    def test_does_not_attach_foreign_property_writes_to_the_current_class(self) -> None:
        """Responsibilities: _foreign property ownership verification_."""
        tree = ast.parse(
            "class Holder:\n"
            "    def configure(self, other: Second):\n"
            "        other.service = Second()\n"
            "    def run(self):\n"
            "        self.service.execute()\n"
        )
        node_index = self._python_ast_node_index()
        node_index.nodes(tree)
        properties: dict[str, str] = {}
        context = PythonReferenceContext(
            PythonReferenceContextOptions(
                PythonReferenceSymbolTables({}, {}, properties, {}), PythonCallReturnStateAdapter({}), node_index
            )
        )
        annotations = AnnotationNames()
        instances = PythonInstanceCollector(tree, context, node_index)
        instances.collect_instances(annotations)

        self.assertNotIn("Holder.service", properties)

    def test_resolves_collection_elements_at_each_reaching_write(self) -> None:
        """Responsibilities: _positioned collection element ownership_."""
        factory = PythonReferenceScenarioFactory()
        scenario = factory.create(
            "class First:\n    def execute(self):\n        pass\n\n"
            "class Second:\n    def execute(self):\n        pass\n\n"
            "def run(values: list[First], replacement: list[Second]):\n"
            "    for item in values:\n        item.execute()\n"
            "    values = replacement\n"
            "    for item in values:\n        item.execute()\n"
        )
        instance_collector = PythonInstanceCollector(scenario.tree, scenario.context, scenario.node_index)
        instance_collector.collect_instances(scenario.annotation_names)
        instance_collector.collect_for_aliases()
        calls = [
            node
            for node in ast.walk(scenario.tree)
            if type(node) is ast.Call and type(node.func) is ast.Attribute
        ]
        owners = [
            scenario.context.attribute_owner(call.func.value, "") for call in calls
        ]
        self.assertEqual(owners, ["First", "Second"])

    def test_keeps_annotated_collection_receiver_as_container(self) -> None:
        """Responsibilities: _annotated collection receiver ownership_."""
        source = ast.parse(
            "class Service:\n    def clear(self):\n        pass\n\n"
            "def run():\n    values: list[Service] = []\n    values.clear()\n"
        )
        tree = source
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)
        context = PythonReferenceContext(
            PythonReferenceContextOptions(
                PythonReferenceSymbolTables({}, {}, {}, {}), PythonCallReturnStateAdapter({}), node_index
            )
        )
        instances = PythonInstanceCollector(tree, context, node_index)
        instances.collect_instances(AnnotationNames())
        instances.collect_for_aliases()
        call = next(
            node
            for node in ast.walk(tree)
            if type(node) is ast.Call and type(node.func) is ast.Attribute
        )
        self.assertEqual(context.attribute_owner(call.func.value, ""), "list")


class PythonReferenceReturnOwnershipTest(unittest.TestCase):
    """Responsibilities: _factory type ownership_, _receiver resolution_."""

    def test_uses_one_return_owner_for_assigned_and_inline_factories(self) -> None:
        """Responsibilities: _factory owner resolution_."""
        factory = PythonReferenceScenarioFactory()
        scenario = factory.create(
            "class Service:\n    def execute(self):\n        pass\n\n"
            "def make() -> Service:\n    return Service()\n\n"
            "def run():\n    assigned = make()\n    assigned.execute()\n    make().execute()\n"
        )
        return_collector = CallReturns(scenario.annotation_names, scenario.return_state)
        return_collector.collect_call_returns(scenario.tree, scenario.context)
        instance_collector = PythonInstanceCollector(scenario.tree, scenario.context, scenario.node_index)
        instance_collector.collect_instances(scenario.annotation_names)
        instance_collector.collect_for_aliases()
        calls = [
            node
            for node in ast.walk(scenario.tree)
            if type(node) is ast.Call and type(node.func) is ast.Attribute
        ]
        owners = [
            scenario.context.attribute_owner(call.func.value, "") for call in calls
        ]
        self.assertEqual(owners, ["Service", "Service"])

    def test_resolves_property_reassignment_at_each_source_position(self) -> None:
        """Responsibilities: _positioned property ownership_."""
        factory = PythonReferenceScenarioFactory()
        scenario = factory.create(
            "class First:\n    def execute(self):\n        pass\n\n"
            "class Second:\n    def execute(self):\n        pass\n\n"
            "class Holder:\n    def run(self):\n"
            "        self.service = First()\n        self.service.execute()\n"
            "        self.service = Second()\n        self.service.execute()\n"
        )
        instance_collector = PythonInstanceCollector(scenario.tree, scenario.context, scenario.node_index)
        instance_collector.collect_instances(scenario.annotation_names)
        instance_collector.collect_for_aliases()
        calls = [
            node
            for node in ast.walk(scenario.tree)
            if type(node) is ast.Call and type(node.func) is ast.Attribute
        ]
        owners = [
            scenario.context.attribute_owner(call.func.value, "Holder")
            for call in calls
        ]
        self.assertEqual(owners, ["First", "Second"])

    def test_resolves_static_and_nested_receiver_parameters_explicitly(self) -> None:
        """Responsibilities: _explicit Python receiver ownership_."""
        factory = PythonReferenceScenarioFactory()
        scenario = factory.create(
            "class Other:\n    def execute(self):\n        pass\n\n"
            "class Holder:\n"
            "    @staticmethod\n    def static(self: Other):\n        self.execute()\n"
            "    def run(self):\n        def inner(self: Other):\n            self.execute()\n"
            "        inner(Other())\n"
        )
        instance_collector = PythonInstanceCollector(scenario.tree, scenario.context, scenario.node_index)
        instance_collector.collect_instances(scenario.annotation_names)
        instance_collector.collect_for_aliases()
        calls = [
            node
            for node in ast.walk(scenario.tree)
            if type(node) is ast.Call and type(node.func) is ast.Attribute
        ]
        owners = [
            scenario.context.attribute_owner(call.func.value, "Holder")
            for call in calls
        ]
        self.assertEqual(owners, ["Other", "Other"])

    def test_keeps_nested_factory_return_identity_lexically_bound(self) -> None:
        """Responsibilities: _lexical factory identity verification_."""
        factory = PythonReferenceScenarioFactory()
        scenario = factory.create(self._nested_factory_source())
        return_collector = CallReturns(scenario.annotation_names, scenario.return_state)
        return_collector.collect_call_returns(scenario.tree, scenario.context)
        instance_collector = PythonInstanceCollector(scenario.tree, scenario.context, scenario.node_index)
        instance_collector.collect_instances(scenario.annotation_names)
        calls = [
            node
            for node in ast.walk(scenario.tree)
            if type(node) is ast.Call and type(node.func) is ast.Attribute
        ]
        owners = [
            scenario.context.attribute_owner(call.func.value, "") for call in calls
        ]
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
        factory = PythonReferenceScenarioFactory()
        scenario = factory.create("def run():\n    pass\n")
        reference = PythonReference(scenario.context)
        function_reference = reference.for_call(
            ast.parse("run()", mode="eval").body, "Service"
        )
        method_reference = reference.for_call(
            ast.parse("service.run()", mode="eval").body, "Service"
        )
        field_reference = reference.for_expression(
            ast.parse("handler.bind", mode="eval").body, 0, "Service"
        )
        self.assertEqual(
            [
                function_reference["kind"],
                method_reference["is_call"],
                field_reference["name"],
            ],
            ["function", True, "bind"],
        )
