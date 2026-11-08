import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("concrete collaborator creation", () => {
	test("resolves a qualified Protocol import when detecting implementation downcasts", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.py": [
					"import typing as typing_module",
					"class StoreContract(typing_module.Protocol):",
					"    def load(self, key: str) -> str: ...",
					"class SqlStore(StoreContract):",
					"    def load(self, key: str) -> str: return key",
					"    def sql_transaction(self) -> None: pass",
					"class Loader:",
					"    def load(self, store: StoreContract, key: str) -> str:",
					"        if isinstance(store, SqlStore): return store.sql_transaction()",
					"        return store.load(key)",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "protocol-downcast-to-implementation")).toHaveLength(1);
	});

	test("does not report Python downcasts when the branch uses only Protocol members", () => {
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
					"    def load(self, store: StoreContract, key: str) -> str:",
					"        if isinstance(store, SqlStore): return store.load(key)",
					"        return store.load(key)",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "protocol-downcast-to-implementation")).toHaveLength(0);
	});

	test("does not treat a deferred Python lambda as a downcast operation", () => {
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
					"    def transaction(self) -> None: pass",
					"class Loader:",
					"    def load(self, store: StoreContract, key: str) -> str:",
					"        if isinstance(store, SqlStore):",
					"            deferred = lambda: store.transaction()",
					"        return store.load(key)",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "protocol-downcast-to-implementation")).toHaveLength(0);
	});

	test("does not treat a nested function body as an executed downcast branch", () => {
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
					"    def sql_transaction(self) -> None: pass",
					"class Loader:",
					"    def load(self, store: StoreContract) -> str:",
					"        if isinstance(store, SqlStore):",
					"            def defer_transaction() -> None:",
					"                store.sql_transaction()",
					"        return store.load('key')",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "protocol-downcast-to-implementation")).toHaveLength(0);
	});

	test("does not report Python narrowing against an unrelated implementation", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.py": [
					"from typing import Protocol",
					"class StoreContract(Protocol):",
					"    def load(self, key: str) -> str: ...",
					"class SqlStore:",
					"    def load(self, key: str) -> str: return key",
					"    def sql_transaction(self) -> None: pass",
					"class Loader:",
					"    def load(self, store: StoreContract, key: str) -> str:",
					"        if isinstance(store, SqlStore): return store.sql_transaction()",
					"        return store.load(key)",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "protocol-downcast-to-implementation")).toHaveLength(0);
	});

	test("does not treat an arbitrary predicate as the built-in isinstance", () => {
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
					"    def sql_transaction(self) -> None: pass",
					"class Loader:",
					"    def load(self, store: StoreContract) -> str:",
					"        if matches_type(store, SqlStore): return store.sql_transaction()",
					'        return store.load("key")',
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "protocol-downcast-to-implementation")).toHaveLength(0);
	});

	test("does not treat a locally shadowed isinstance name as the built-in", () => {
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
					"    def sql_transaction(self) -> None: pass",
					"class Loader:",
					"    def load(self, store: StoreContract) -> str:",
					"        isinstance = self.custom_check",
					"        if isinstance(store, SqlStore): return store.sql_transaction()",
					'        return store.load("key")',
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "protocol-downcast-to-implementation")).toHaveLength(0);
	});

	test("does not resolve a Python local constructor parameter as the project class", () => {
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
					"    def sql_transaction(self) -> None: pass",
					"class Loader:",
					"    def load(self, store: StoreContract, SqlStore: type[StoreContract]) -> str:",
					"        if isinstance(store, SqlStore): return store.sql_transaction()",
					'        return store.load("key")',
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "protocol-downcast-to-implementation")).toHaveLength(0);
	});

	test("reports TypeScript downcasts that call an implementation-only member", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.ts": [
					"interface StoreContract { load(key: string): string; }",
					"class SqlStore implements StoreContract {",
					"  public load(key: string): string { return key; }",
					"  public sql_transaction(): void {}",
					"}",
					"class Loader {",
					"  public load(store: StoreContract, key: string): string {",
					"    if (store instanceof SqlStore) { store.sql_transaction(); }",
					"    return store.load(key);",
					"  }",
					"}",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "protocol-downcast-to-implementation")).toHaveLength(1);
		expect(violations.filter((item) => item.rule_id() === "typescript-instanceof")).toHaveLength(0);
	});

	test("does not report a downcast when the branch only calls contract members", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.ts": [
					"interface StoreContract { load(key: string): string; }",
					"class SqlStore implements StoreContract { public load(key: string): string { return key; } }",
					"class Loader {",
					"  public load(store: StoreContract, key: string): string {",
					"    if (store instanceof SqlStore) { return store.load(key); }",
					"    return store.load(key);",
					"  }",
					"}",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "protocol-downcast-to-implementation")).toHaveLength(0);
	});

	test("does not treat a check against an unrelated external class as a project downcast", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.ts": [
					"interface StoreContract { load(key: string): string; }",
					"class Loader {",
					"  public load(store: StoreContract, key: string): string {",
					"    if (store instanceof Date) { return key; }",
					"    return store.load(key);",
					"  }",
					"}",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "protocol-downcast-to-implementation")).toHaveLength(0);
	});

	test("does not associate a shadowed local value with the contract parameter", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.ts": [
					"interface StoreContract { load(key: string): string; }",
					"class SqlStore implements StoreContract {",
					"  public load(key: string): string { return key; }",
					"  public sql_transaction(): void {}",
					"}",
					"class Loader {",
					"  public load(store: StoreContract, key: string): string {",
					"    {",
					"      const store: SqlStore = new SqlStore();",
					"      if (store instanceof SqlStore) { store.sql_transaction(); }",
					"    }",
					"    return key;",
					"  }",
					"}",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "protocol-downcast-to-implementation")).toHaveLength(0);
	});

	test("does not resolve a TypeScript constructor parameter as the project class", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.ts": [
					"interface StoreContract { load(key: string): string; }",
					"class SqlStore implements StoreContract {",
					"  public load(key: string): string { return key; }",
					"  public sql_transaction(): void {}",
					"}",
					"class Loader {",
					"  public load(store: StoreContract, SqlStore: new () => StoreContract): string {",
					"    if (store instanceof SqlStore) { store.sql_transaction(); }",
					'    return store.load("key");',
					"  }",
					"}",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "protocol-downcast-to-implementation")).toHaveLength(0);
	});

	test("does not treat a user class named Protocol as typing.Protocol", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.py": [
					"class Protocol: pass",
					"class StoreContract(Protocol):",
					"    def load(self, key: str) -> str: ...",
					"class SqlStore(StoreContract):",
					"    def load(self, key: str) -> str: return key",
					"    def sql_transaction(self) -> None: pass",
					"class Loader:",
					"    def load(self, key: str) -> str:",
					"        store = SqlStore()",
					"        if isinstance(store, SqlStore): return store.sql_transaction()",
					"        return store.load(key)",
				].join("\n"),
			},
		);

		expect(
			violations.filter((item) =>
				["concrete-collaborator-created-per-operation", "protocol-downcast-to-implementation"].includes(item.rule_id()),
			),
		).toHaveLength(0);
	});
});
