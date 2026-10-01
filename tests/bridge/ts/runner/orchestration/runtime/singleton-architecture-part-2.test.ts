import "src/bridge/ts/runner/orchestration/runtime/file-lint";
import "src/bridge/ts/runner/orchestration/runtime/coding-rules";
import { describe, expect, test } from "@jest/globals";

import { TestFixture } from "tests/core/test-fixture";

describe("singleton architecture rules", () => {
	test("reports ClassVar through static mapping aliases", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"mapped-classvar.py": [
				"from typing import ClassVar",
				'classvar_key = "classvar"',
				"type_aliases = {classvar_key: ClassVar}",
				"class Registry:",
				"    entries: type_aliases[classvar_key][dict[str, str]] = {}",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "singleton")).toHaveLength(1);
	});

	test("reports TypeScript singleton initialization variants", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"variants.ts": [
				"class Service {}",
				"function create_service(value: number): Service { return new Service(); }",
				"const with_argument = create_service(1);",
				"export default new Service();",
				"const nested = { service: new Service() };",
				"namespace Scope { export const named = new Service(); }",
			].join("\n"),
		});
		expect(violations.filter((item) => item.rule_id === "singleton").map((item) => item.line)).toEqual([3, 4, 5, 6]);
	});

	test("reports singleton factory results through callable aliases", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"factory-alias.ts": [
				"class Service {}",
				"function create_service(): Service { return new Service(); }",
				"const make = create_service;",
				"const service = make();",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "singleton")).toHaveLength(1);
	});

	test("reports singleton factory results through destructured aliases", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"destructured-factory-alias.ts": [
				"class Service {}",
				"function create_service(): Service { return new Service(); }",
				"const { create_service: make } = { create_service };",
				"const service = make();",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "singleton")).toHaveLength(1);
	});

	test("reports singleton factory results through aliased objects", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"object-factory-alias.ts": [
				"class Service {}",
				"function create_service(): Service { return new Service(); }",
				"const factories = { create_service };",
				"const { create_service: make } = factories;",
				"const service = make();",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "singleton")).toHaveLength(1);
	});

	test("reports anonymous class singleton initialization", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"anonymous.ts": "const service = new (class Service { run(): void {} })();",
		});

		expect(violations.filter((item) => item.rule_id === "singleton")).toHaveLength(1);
	});

	test("reports singleton factories inside namespaces", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"namespace-singleton.ts": [
				"class Service {",
				"\tpublic run(): void {}",
				"}",
				"namespace CandidateNamespace {",
				"\tfunction make_candidate(): Service {",
				"\t\treturn new Service();",
				"\t}",
				"\texport let candidate = make_candidate();",
				"}",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "singleton")).toEqual([expect.objectContaining({ line: 8 })]);
	});

	test("reports singleton constructors through namespace import aliases", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"service.ts": "export class Service {}",
			"consumer.ts": [
				"import * as Domain from './service';",
				"const Api = Domain;",
				"const service = new Api.Service();",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "singleton")).toHaveLength(1);
	});
});
