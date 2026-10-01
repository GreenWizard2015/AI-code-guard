import "src/bridge/ts/runner/orchestration/runtime/python/python-rule-collector";
import "src/bridge/ts/runner/orchestration/runtime/python/python-ast-file-rule-collector";
import { TestFixture } from "tests/core/test-fixture";
import { describe, expect, test } from "@jest/globals";

describe("coding-lint Python-specific rules", () => {
	test("resolves typing and factory aliases through mappings", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"typing-map.py": [
				"from typing import NamedTuple, Optional, Tuple, Union",
				'typing_aliases = {"optional": Optional, "union": Union, "tuple": Tuple}',
				'def load(value: typing_aliases["optional"][int]) -> None:',
				"    return None",
				'def combine(value: typing_aliases["union"][int, str]) -> None:',
				"    return None",
				"class State:",
				'    items: typing_aliases["tuple"][int, str]',
				'factories = {"record": NamedTuple}',
				'Record = factories["record"]("Record", [])',
			].join("\n"),
		});

		expect({
			nullable: violations.filter((item) => item.rule_id === "nullable-domain-type").length,
			composite: violations.filter((item) => item.rule_id === "composite-state-type").length,
			tuple: violations.filter((item) => item.rule_id === "tuple-type").length,
			factory: violations.filter((item) => item.rule_id === "python-type-factory").length,
		}).toEqual({ nullable: 1, composite: 1, tuple: 1, factory: 1 });
	});

	test("resolves broad exception aliases through mappings", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
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
		});

		expect({
			broad: violations.filter((item) => item.rule_id === "broad-except").length,
			multiple: violations.filter((item) => item.rule_id === "python-multi-except").length,
		}).toEqual({ broad: 3, multiple: 0 });
	});

	test("resolves exception tuple aliases through mappings", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"exception-tuple-map.py": [
				'exceptions = {"many": (ValueError, TypeError)}',
				"try:",
				"    raise ValueError()",
				'except exceptions["many"]:',
				"    value = 5",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "python-multi-except")).toHaveLength(1);
	});

	test("resolves exception group aliases through mappings", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
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
		});

		expect(violations.filter((item) => item.rule_id === "python-multi-except")).toHaveLength(2);
	});

	test("resolves Python decorator aliases through mappings", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"decorator-map.py": [
				"from builtins import staticmethod as static_method_factory",
				'decorators = {"static": static_method_factory}',
				'static_decorator = decorators["static"]',
				"class Service:",
				"    @static_decorator",
				"    def build(value: int) -> int:",
				"        return value",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "python-static-method")).toHaveLength(1);
	});

	test("resolves direct subscript decorator aliases", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
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
		});

		expect(violations.filter((item) => item.rule_id === "python-static-method")).toHaveLength(1);
		expect(violations.filter((item) => item.rule_id === "python-class-method")).toHaveLength(1);
	});

	test("rejects direct class constructor calls", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
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
		});

		expect(messages.filter((message) => message === "avoid direct calls to Class.__init__")).toHaveLength(3);
	});

	test("rejects callable objects through __call__", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			"call-method.py": ["class Runner:", "    def __call__(self, value):", "        return value"].join("\n"),
		});

		expect(messages).toContain("avoid __call__ methods");
	});

	test("rejects callable feature detection in match guards", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			"callable-match.py": [
				"class Handler:",
				"    pass",
				"",
				"handler = Handler()",
				"match handler:",
				"    case _ if callable(handler):",
				"        pass",
			].join("\n"),
		});

		expect(messages).toContain("avoid callable feature detection for project-owned interfaces");
	});

	test("rejects direct object attribute mutation", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			"object-setattr.py": [
				"def update(value):",
				'    object.__setattr__(value, "name", "updated")',
				"destructured_set_attr, ignored = (object.__setattr__, None)",
				'destructured_set_attr(value, "other", "updated")',
			].join("\n"),
		});

		expect(messages).toContain("avoid direct object.__setattr__ calls");
	});

	test("rejects object attribute mutation through a mapping callable", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			"mapped-object-setattr.py": [
				'def update(value):\n    setters = {"set": object.__setattr__}\n    setters["set"](value, "name", "updated")',
			].join("\n"),
		});

		expect(messages).toContain("avoid direct object.__setattr__ calls");
	});

	test("reports instance field writes outside constructors", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
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
		});

		expect(messages.filter((message) => message === "avoid assigning class fields outside constructors")).toHaveLength(
			4,
		);
	});

	test("resolves nested Python mapping aliases", () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			"nested-python-aliases.py": [
				"import builtins",
				"import importlib",
				'factories = {"builtins": builtins}',
				'created_type = factories["builtins"].type("Created", (), {})',
				'loaders = {"module": importlib}',
				'candidate_module = loaders["module"].import_module("candidate_module")',
			].join("\n"),
		});
		expect(messages.filter((message) => message === "avoid dynamic class construction with type(...)")).toHaveLength(1);
		expect(messages.filter((message) => message === "avoid dynamic imports")).toHaveLength(1);
	});

	test("resolves importlib dictionary aliases", () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			"importlib-dictionary.py": [
				"import importlib",
				'load_module = importlib.__dict__["import_module"]',
				'module = load_module("json")',
			].join("\n"),
		});

		expect(messages.filter((message) => message === "avoid dynamic imports")).toHaveLength(1);
	});

	test("rejects Python property setters", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
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
		});

		expect(messages).toContain("avoid Python property setters");
	});
});
