from __future__ import annotations

import ast
import unittest

from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.type_declarations.annotation_names import AnnotationNames
from implementation.references.instances.python_property_type import PythonPropertyType
from implementation.references.instances.python_property_type_collector import (
    PythonPropertyTypeCollector,
)


class PythonPropertyTypeCollectionTest(unittest.TestCase):
    """Responsibilities: _declared property type collection_, _annotation alias resolution_."""

    def test_tracks_properties(self) -> None:
        """Responsibilities: _property tracking verification_."""
        source = ast.parse("class Service:\n    current: Alias\n    model: Model\n")
        index = PythonAstNodeIndex()
        names = AnnotationNames(index)
        index.nodes(source)
        property_types = PythonPropertyType({"Alias": "Model"}, {"Service", "Alias"}, names)
        collector = PythonPropertyTypeCollector(source, property_types, index)
        properties = collector.collect_properties()
        self.assertEqual(
            {
                "current": properties["Service.current"],
                "model": properties["Service.model"],
            },
            {"current": "Model", "model": "Model"},
        )

    def test_infers_initialized_property_from_parameter_annotation(self) -> None:
        """Responsibilities: _initializer property type inference_."""
        source = ast.parse(
            "class Model:\n    pass\n"
            "class Service:\n"
            "    def __init__(self, model: Model):\n"
            "        self.model = model\n",
        )
        index = PythonAstNodeIndex()
        names = AnnotationNames(index)
        index.nodes(source)
        property_types = PythonPropertyType({}, {"Service", "Model"}, names)
        collector = PythonPropertyTypeCollector(source, property_types, index)
        properties = collector.collect_properties()

        self.assertEqual(properties, {"Service.model": "Model"})

    def test_resolves_property_types_from_annotations_and_values(self) -> None:
        """Responsibilities: _property type resolution results_."""
        source = ast.parse(
            "class Model:\n    pass\n"
            "class Service:\n"
            "    def __init__(self, model: Alias):\n"
            "        self.from_parameter = model\n"
            "        self.from_constructor = Model()\n"
            "        self.from_annotation: Alias = model\n",
        )
        index = PythonAstNodeIndex()
        names = AnnotationNames(index)
        index.nodes(source)
        property_types = PythonPropertyType({"Alias": "Model"}, {"Model", "Service"}, names)
        collector = PythonPropertyTypeCollector(source, property_types, index)
        properties = collector.collect_properties()

        self.assertEqual(
            properties,
            {
                "Service.from_parameter": "Model",
                "Service.from_constructor": "Model",
                "Service.from_annotation": "Model",
            },
        )
