import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("concrete collaborator creation", () => {
	test("reports a TypeScript contract implementation constructed and used inside an operation", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"store-contract.ts": "export interface StoreContract { load(key: string): string; }",
				"sql-store.ts": [
					'import { StoreContract } from "./store-contract";',
					"export class SqlStore implements StoreContract { public load(key: string): string { return key; } }",
				].join("\n"),
				"functions.ts": [
					'import type { StoreContract } from "./store-contract";',
					'import { SqlStore } from "./sql-store";',
					"class Loader {",
					"  public load(key: string): string {",
					"    const store: StoreContract = new SqlStore();",
					"    return store.load(key);",
					"  }",
					"}",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "concrete-collaborator-created-per-operation")).toHaveLength(
			1,
		);
	});

	test("accepts TypeScript collaborator injection through its project contract", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.ts": [
					"interface StoreContract { load(key: string): string; }",
					"class Loader {",
					"  private readonly store: StoreContract;",
					"  public constructor(store: StoreContract) { this.store = store; }",
					"  public load(key: string): string { return this.store.load(key); }",
					"}",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "concrete-collaborator-created-per-operation")).toHaveLength(
			0,
		);
	});

	test("does not report an unused concrete construction", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.ts": [
					"interface StoreContract { load(key: string): string; }",
					"class SqlStore implements StoreContract { public load(key: string): string { return key; } }",
					"class Loader { public load(key: string): string { new SqlStore(); return key; } }",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "concrete-collaborator-created-per-operation")).toHaveLength(
			0,
		);
	});

	test("does not treat an inferred concrete TypeScript type as a protocol boundary", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"store-contract.ts": "export interface StoreContract { load(key: string): string; }",
				"sql-store.ts": [
					'import { StoreContract } from "./store-contract";',
					"export class SqlStore implements StoreContract { public load(key: string): string { return key; } }",
				].join("\n"),
				"functions.ts": [
					'import { SqlStore } from "./sql-store";',
					"class Loader {",
					"  public load(key: string): string {",
					"    const store = new SqlStore();",
					"    return store.load(key);",
					"  }",
					"}",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "concrete-collaborator-created-per-operation")).toHaveLength(
			0,
		);
	});

	test("does not attribute a later TypeScript contract call to an overwritten concrete instance", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.ts": [
					"interface StoreContract { load(key: string): string; }",
					"class SqlStore implements StoreContract { public load(key: string): string { return key; } }",
					"class Loader {",
					"  public load(replacement: StoreContract, key: string): string {",
					"    let store = new SqlStore();",
					"    store = replacement;",
					"    return store.load(key);",
					"  }",
					"}",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "concrete-collaborator-created-per-operation")).toHaveLength(
			0,
		);
	});

	test("accepts collaborator construction at the composition boundary", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.ts": [
					"interface StoreContract { load(key: string): string; }",
					"class SqlStore implements StoreContract { public load(key: string): string { return key; } }",
					"class Loader {",
					"  private readonly store: StoreContract;",
					"  public constructor() { this.store = new SqlStore(); }",
					"  public load(key: string): string { return this.store.load(key); }",
					"}",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "concrete-collaborator-created-per-operation")).toHaveLength(
			0,
		);
	});

	test("does not report construction used only through implementation-specific members", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.ts": [
					"interface StoreContract { load(key: string): string; }",
					"class SqlStore implements StoreContract {",
					"  public load(key: string): string { return key; }",
					"  public transaction(): void {}",
					"}",
					"class Loader {",
					"  public load(key: string): string {",
					"    const store = new SqlStore();",
					"    store.transaction();",
					"    return key;",
					"  }",
					"}",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "concrete-collaborator-created-per-operation")).toHaveLength(
			0,
		);
	});

	test("does not treat a locally shadowed TypeScript class name as the indexed implementation", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.ts": [
					"interface StoreContract { load(key: string): string; }",
					"class SqlStore implements StoreContract { public load(key: string): string { return key; } }",
					"class Loader {",
					"  public load(factory: new () => StoreContract, key: string): string {",
					"    {",
					"      const SqlStore = factory;",
					"      const store = new SqlStore();",
					"      return store.load(key);",
					"    }",
					"  }",
					"}",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "concrete-collaborator-created-per-operation")).toHaveLength(
			0,
		);
	});

	test("reports a TypeScript concrete collaborator kept in a local alias", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"store-contract.ts": "export interface StoreContract { load(key: string): string; }",
				"sql-store.ts": [
					'import { StoreContract } from "./store-contract";',
					"export class SqlStore implements StoreContract { public load(key: string): string { return key; } }",
				].join("\n"),
				"functions.ts": [
					'import type { StoreContract } from "./store-contract";',
					'import { SqlStore } from "./sql-store";',
					"class Loader {",
					"  public load(key: string): string {",
					"    const store: StoreContract = new SqlStore();",
					"    return store.load(key);",
					"  }",
					"}",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "concrete-collaborator-created-per-operation")).toHaveLength(
			1,
		);
	});

	test("reports a Python protocol implementation constructed and used inside an operation", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.py": [
					"from typing import Protocol",
					"class StoreContract(Protocol):",
					"    def load(self, key: str) -> str: ...",
					"class SqlStore(StoreContract):",
					"    def load(self, key: str) -> str: return key",
					"class Loader:",
					"    def load(self, key: str) -> str:",
					"        store: StoreContract = SqlStore()",
					"        return store.load(key)",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "concrete-collaborator-created-per-operation")).toHaveLength(
			1,
		);
	});

	test("reports an imported Python protocol implementation constructed in an operation", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"src/__init__.py": "",
				"src/protocols.py": [
					"from typing import Protocol",
					"class StoreContract(Protocol):",
					"    def load(self, key: str) -> str: ...",
				].join("\n"),
				"src/sql_store.py": [
					"from .protocols import StoreContract",
					"class SqlStore(StoreContract):",
					"    def load(self, key: str) -> str: return key",
				].join("\n"),
				"src/loader.py": [
					"from .protocols import StoreContract",
					"from .sql_store import SqlStore as DatabaseStore",
					"class Loader:",
					"    def load(self, key: str) -> str:",
					"        store: StoreContract = DatabaseStore()",
					"        return store.load(key)",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "concrete-collaborator-created-per-operation")).toHaveLength(
			1,
		);
	});

	test("does not report an imported concrete collaborator called inline without a protocol boundary", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"src/__init__.py": "",
				"src/protocols.py": [
					"from typing import Protocol",
					"class StoreContract(Protocol):",
					"    def load(self, key: str) -> str: ...",
				].join("\n"),
				"src/sql_store.py": [
					"from .protocols import StoreContract",
					"class SqlStore(StoreContract):",
					"    def load(self, key: str) -> str: return key",
				].join("\n"),
				"src/loader.py": [
					"from .sql_store import SqlStore",
					"class Loader:",
					"    def load(self, key: str) -> str:",
					"        return SqlStore().load(key)",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "concrete-collaborator-created-per-operation")).toHaveLength(
			0,
		);
	});

	test("keeps contract members from every imported Protocol implemented by a class", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"src/__init__.py": "",
				"src/protocols.py": [
					"from typing import Protocol",
					"class StoreContract(Protocol):",
					"    def load(self, key: str) -> str: ...",
					"class HealthContract(Protocol):",
					"    def healthy(self) -> bool: ...",
				].join("\n"),
				"src/sql_store.py": [
					"from .protocols import HealthContract, StoreContract",
					"class SqlStore(StoreContract, HealthContract):",
					"    def load(self, key: str) -> str: return key",
					"    def healthy(self) -> bool: return True",
				].join("\n"),
				"src/loader.py": [
					"from .protocols import StoreContract",
					"from .sql_store import SqlStore",
					"class Loader:",
					"    def load(self, key: str) -> str:",
					"        store: StoreContract = SqlStore()",
					"        return store.load(key)",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "concrete-collaborator-created-per-operation")).toHaveLength(
			1,
		);
	});

	test("does not connect an unused imported construction to an injected protocol call", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"src/__init__.py": "",
				"src/protocols.py": [
					"from typing import Protocol",
					"class StoreContract(Protocol):",
					"    def load(self, key: str) -> str: ...",
				].join("\n"),
				"src/sql_store.py": [
					"from .protocols import StoreContract",
					"class SqlStore(StoreContract):",
					"    def load(self, key: str) -> str: return key",
				].join("\n"),
				"src/loader.py": [
					"from .protocols import StoreContract",
					"from .sql_store import SqlStore",
					"class Loader:",
					"    def load(self, injected: StoreContract, key: str) -> str:",
					"        unused = SqlStore()",
					"        return injected.load(key)",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "concrete-collaborator-created-per-operation")).toHaveLength(
			0,
		);
	});
});
