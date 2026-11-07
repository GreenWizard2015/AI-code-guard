import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import type { ViolationContract } from "src/reporting_protocols";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("public contract implementation fields", () => {
	/** Responsibilities: _project lint violation collection_. **/
	const project_violations = (
		configuration: LintRunConfiguration,
		files: Record<string, string>,
	): ViolationContract[] => {
		const fixture = new TestFixture();
		return fixture.with_lint_request(
			configuration,
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
	};

	test("reports public fields declared by TypeScript contract implementations", () => {
		const configuration = new LintRunConfiguration(new InMemoryProjectSourceIO(new Map()), new InMemoryFileIO());
		const violations = project_violations(configuration, {
			"store.ts": [
				"interface StoreContract { read(): string; }",
				"class Store implements StoreContract {",
				'  public state: string = "ready";',
				"  public read(): string { return this.state; }",
				"}",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id() === "public-field-on-contract-implementation")).toHaveLength(1);
	});

	test("reports public fields declared by Python protocol implementations", () => {
		const configuration = new LintRunConfiguration(new InMemoryProjectSourceIO(new Map()), new InMemoryFileIO());
		const violations = project_violations(configuration, {
			"store.py": [
				"from typing import Protocol",
				"class StoreContract(Protocol):",
				"    def read(self) -> str: ...",
				"class Store(StoreContract):",
				"    state: str",
				"    def read(self) -> str:",
				"        return self.state",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id() === "public-field-on-contract-implementation")).toHaveLength(1);
	});

	test("reports field writes outside private own state in TypeScript and Python", () => {
		const configuration = new LintRunConfiguration(new InMemoryProjectSourceIO(new Map()), new InMemoryFileIO());
		const violations = project_violations(configuration, {
			"store_model.ts": [
				"class Store {",
				"  private _state: { value: string };",
				"  public constructor() { this._state = { value: 'ready' }; }",
				"  public update(): void { this._state.value = 'inside'; this.state = 'public'; createStore().state = 'temporary'; }",
				"}",
			].join("\n"),
			"store_factory.ts": [
				'import { Store } from "./store_model";',
				"export function createStore(): Store { return new Store(); }",
			].join("\n"),
			"use_store.ts": [
				'import { Store } from "./store_model";',
				"const store = new Store();",
				'store.state = "outside";',
				'store["state"] += "again";',
				"store.state++;",
			].join("\n"),
			"store.py": [
				"class Store:",
				"    def __init__(self) -> None:",
				"        self._state: dict[str, str] = {'value': 'ready'}",
				"    def update(self) -> None:",
				"        self._state.value = 'inside'",
				"        self.state = 'public'",
				"store = Store()",
				'store.state = "outside"',
				'store.state += "again"',
				'store["state"] = "third"',
				"Store().state = 'temporary'",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id() === "object-field-write").map((item) => item.file())).toEqual([
			"store.py",
			"store.py",
			"store.py",
			"store.py",
			"store_model.ts",
			"store_model.ts",
			"use_store.ts",
			"use_store.ts",
		]);
	});

	test("allows private fields, internal assignments, and external reads", () => {
		const configuration = new LintRunConfiguration(new InMemoryProjectSourceIO(new Map()), new InMemoryFileIO());
		const violations = project_violations(configuration, {
			"store.ts": [
				"class Store {",
				"  private _state: { value: string };",
				'  public constructor() { this._state = { value: "ready" }; }',
				'  public update(): void { this._state.value = "inside"; }',
				"  public read(): string { return this._state.value; }",
				"}",
				"const store = new Store();",
				"store.read();",
			].join("\n"),
			"store.py": [
				"class Store:",
				"    _state: dict[str, str]",
				"    def update(self) -> None:",
				'        self._state.value = "inside"',
				"    def read(self) -> str:",
				"        return self._state",
				"store = Store()",
				"store.read()",
			].join("\n"),
		});

		expect(
			violations.filter((item) =>
				["public-field-on-contract-implementation", "object-field-write"].includes(item.rule_id()),
			),
		).toHaveLength(0);
	});
});
