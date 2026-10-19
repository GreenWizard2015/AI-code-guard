import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("Python alias resolution in project lint", () => {
	test("resolves type, exception, and decorator aliases from source results", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"typing-map.py": [
					"from typing import NamedTuple, Optional, Tuple, Union",
					'python_typing_aliases = {"optional": Optional, "union": Union, "tuple": Tuple}',
					'def load(value: python_typing_aliases["optional"][int]) -> None:',
					"    return None",
					'def combine(value: python_typing_aliases["union"][int, str]) -> None:',
					"    return None",
					"class State:",
					'    items: python_typing_aliases["tuple"][int, str]',
					'factories = {"record": NamedTuple}',
					'Record = factories["record"]("Record", [])',
				].join("\n"),
				"broad-exception-map.py": [
					"import builtins",
					'broad_exceptions = {"exception": Exception, "base": BaseException}',
					"try:",
					"    value = 1",
					'except broad_exceptions["exception"]:',
					"    value = 2",
					"try:",
					"    value = 3",
					'except broad_exceptions["base"]:',
					"    value = 4",
					"try:",
					"    value = 6",
					'except getattr(builtins, "Exception"):',
					"    value = 7",
				].join("\n"),
				"exception-tuple-map.py": [
					'exceptions = {"many": (ValueError, TypeError)}',
					"try:",
					"    raise ValueError()",
					'except exceptions["many"]:',
					"    value = 5",
				].join("\n"),
				"exception-group-map.py": [
					"exceptions_list = [ValueError, TypeError]",
					"exception_group = (*exceptions_list,)",
					"try:",
					"    raise ValueError()",
					"except exception_group:",
					"    value = 5",
					"exception_group_from_call = tuple(exceptions_list)",
					"try:",
					"    raise ValueError()",
					"except exception_group_from_call:",
					"    value = 5",
				].join("\n"),
				"decorator-map.py": [
					"from builtins import staticmethod as static_method_factory",
					'decorators = {"static": static_method_factory}',
					'static_decorator = decorators["static"]',
					"class Service:",
					"    @static_decorator",
					"    def build(value: int) -> int:",
					"        return value",
				].join("\n"),
				"direct-decorator-map.py": [
					"from builtins import classmethod, staticmethod",
					'decorators = {"static": staticmethod, "class": classmethod}',
					"class Service:",
					'    @decorators["static"]',
					"    def build(value: int) -> int:",
					"        return value",
					"",
					'    @decorators["class"]',
					"    def create(cls, value: int) -> int:",
					"        return value",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		/** Responsibilities: _violation counts_. **/
		const count_for = (rule_id: string, file: string): number =>
			violations.filter((item) => item.rule_id === rule_id && item.file === file).length;
		expect({
			typing_nullable: count_for("nullable-domain-type", "typing-map.py"),
			typing_composite: count_for("composite-state-type", "typing-map.py"),
			typing_tuple: count_for("tuple-type", "typing-map.py"),
			typing_factory: count_for("python-type-factory", "typing-map.py"),
			broad_exceptions: count_for("broad-except", "broad-exception-map.py"),
			broad_multi: count_for("python-multi-except", "broad-exception-map.py"),
			tuple_exceptions: count_for("python-multi-except", "exception-tuple-map.py"),
			group_exceptions: count_for("python-multi-except", "exception-group-map.py"),
			mapped_static: count_for("python-static-method", "decorator-map.py"),
			direct_static: count_for("python-static-method", "direct-decorator-map.py"),
			direct_class: count_for("python-class-method", "direct-decorator-map.py"),
		}).toEqual({
			typing_nullable: 1,
			typing_composite: 1,
			typing_tuple: 1,
			typing_factory: 1,
			broad_exceptions: 3,
			broad_multi: 0,
			tuple_exceptions: 1,
			group_exceptions: 2,
			mapped_static: 1,
			direct_static: 1,
			direct_class: 1,
		});
	});

	test("reports aliased dynamic calls, mutation, and setters in production files", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"direct-init.py": [
					"class Child(Base):",
					"    def __init__(self):",
					"        Base.__init__(self)",
					"",
					"base_init = Base.__init__",
					"",
					"def reset(value):",
					"    Other.__init__(value)",
					"",
					"def reset_alias(value):",
					"    base_init(value)",
				].join("\n"),
				"call-method.py": ["class Runner:", "    def __call__(self, value):", "        return value"].join("\n"),
				"callable-match.py": [
					"class Handler:",
					"    pass",
					"",
					"handler = Handler()",
					"match handler:",
					"    case _ if callable(handler):",
					"        pass",
				].join("\n"),
				"object-setattr.py": [
					"def update(value):",
					'    object.__setattr__(value, "name", "updated")',
					"destructured_set_attr, ignored = (object.__setattr__, None)",
					'destructured_set_attr(value, "other", "updated")',
				].join("\n"),
				"mapped-object-setattr.py": [
					'def update(value):\n    setters = {"set": object.__setattr__}\n    setters["set"](value, "name", "updated")',
				].join("\n"),
				"mutable-fields.py": [
					"class Profile:",
					"    def __init__(self, name):",
					"        self.name = name",
					"",
					"    def rename(self, name):",
					"        self.name = name",
					"        self.version += 1",
					'        field_name = "name"',
					"        self.__dict__[field_name] = name",
					'        vars(self)["name"] = name',
					"",
					"    def __post_init__(self):",
					"        self.ready = True",
				].join("\n"),
				"nested-python-aliases.py": [
					"import builtins",
					"import importlib",
					'factories = {"builtins": builtins}',
					'created_type = factories["builtins"].type("Created", (), {})',
					'loaders = {"module": importlib}',
					'candidate_module = loaders["module"].import_module("candidate_module")',
				].join("\n"),
				"importlib-dictionary.py": [
					"import importlib",
					'load_module = importlib.__dict__["import_module"]',
					'module = load_module("json")',
				].join("\n"),
				"property-setter.py": [
					"class Profile:",
					"    @property",
					"    def name(self):",
					"        return self._name",
					"",
					"    @name.setter",
					"    def name(self, value):",
					"        self._name = value",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		/** Responsibilities: _message violation counts_. **/
		const count_for = (message: string, file: string): number =>
			violations.filter((item) => item.message === message && item.file === file).length;
		expect({
			direct_init: count_for("avoid direct calls to Class.__init__", "direct-init.py"),
			call_method: count_for("avoid __call__ methods", "call-method.py"),
			callable_match: count_for("avoid callable feature detection for project-owned interfaces", "callable-match.py"),
			object_setattr: count_for("avoid direct object.__setattr__ calls", "object-setattr.py"),
			mapped_setattr: count_for("avoid direct object.__setattr__ calls", "mapped-object-setattr.py"),
			field_writes: count_for("avoid assigning class fields outside constructors", "mutable-fields.py"),
			dynamic_type: count_for("avoid dynamic class construction with type(...)", "nested-python-aliases.py"),
			dynamic_import: violations.filter(
				(item) =>
					item.message === "avoid dynamic imports" &&
					(item.file === "nested-python-aliases.py" || item.file === "importlib-dictionary.py"),
			).length,
			property_setter: count_for("avoid Python property setters", "property-setter.py"),
		}).toEqual({
			direct_init: 3,
			call_method: 1,
			callable_match: 1,
			object_setattr: 2,
			mapped_setattr: 1,
			field_writes: 4,
			dynamic_type: 1,
			dynamic_import: 2,
			property_setter: 1,
		});
	});
});
