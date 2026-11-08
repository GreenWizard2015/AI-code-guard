import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("concrete collaborator creation", () => {
	const negative_python_scenarios: Record<string, string> = {
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
		"src/scenarios/__init__.py": "",
		"src/scenarios/deferred_loader.py": [
			"from ..sql_store import SqlStore",
			"class Loader:",
			"    def nested(self, key: str) -> str:",
			"        def later() -> str:",
			"            store = SqlStore()",
			"            return store.load(key)",
			"        return key",
			"    def lazy(self, key: str) -> str:",
			"        deferred = lambda: SqlStore().load(key)",
			"        return key",
		].join("\n"),
		"src/scenarios/rebound_before_contract.py": [
			"from ..protocols import StoreContract",
			"from ..sql_store import SqlStore",
			"class Loader:",
			"    def load(self, replacement: StoreContract, key: str) -> str:",
			"        store = SqlStore()",
			"        store = replacement",
			"        return store.load(key)",
		].join("\n"),
		"src/scenarios/shadowed_parameter.py": [
			"from ..sql_store import SqlStore",
			"class Loader:",
			"    def load(self, SqlStore, key: str) -> str:",
			"        store = SqlStore()",
			"        return store.load(key)",
		].join("\n"),
		"src/scenarios/reassigned_import_alias.py": [
			"from ..sql_store import SqlStore",
			"class Loader:",
			"    def load(self, factory, key: str) -> str:",
			"        SqlStore = factory",
			"        store = SqlStore()",
			"        return store.load(key)",
		].join("\n"),
		"src/scenarios/module_reassigned_import.py": [
			"from ..protocols import StoreContract",
			"from ..sql_store import SqlStore",
			"SqlStore = make_store()",
			"class Loader:",
			"    def load(self, key: str) -> str:",
			"        store: StoreContract = SqlStore()",
			"        return store.load(key)",
		].join("\n"),
		"injected_collaborator.py": [
			"from typing import Protocol",
			"class StoreContract(Protocol):",
			"    def load(self, key: str) -> str: ...",
			"class Loader:",
			"    def __init__(self, store: StoreContract) -> None:",
			"        self.store = store",
			"    def load(self, key: str) -> str:",
			"        return self.store.load(key)",
		].join("\n"),
		"constructor_owned_collaborator.py": [
			"from typing import Protocol",
			"class StoreContract(Protocol):",
			"    def load(self, key: str) -> str: ...",
			"class SqlStore(StoreContract):",
			"    def load(self, key: str) -> str: return key",
			"class Loader:",
			"    def __init__(self) -> None:",
			"        self.store: StoreContract = SqlStore()",
			"    def load(self, key: str) -> str:",
			"        return self.store.load(key)",
		].join("\n"),
		"unused_construction.py": [
			"from typing import Protocol",
			"class StoreContract(Protocol):",
			"    def load(self, key: str) -> str: ...",
			"class SqlStore(StoreContract):",
			"    def load(self, key: str) -> str: return key",
			"class Loader:",
			"    def load(self, key: str) -> str:",
			"        SqlStore()",
			"        return key",
		].join("\n"),
		"overwritten_instance.py": [
			"from typing import Protocol",
			"class StoreContract(Protocol):",
			"    def load(self, key: str) -> str: ...",
			"class SqlStore(StoreContract):",
			"    def load(self, key: str) -> str: return key",
			"class Loader:",
			"    def load(self, replacement: StoreContract, key: str) -> str:",
			"        store = SqlStore()",
			"        store = replacement",
			"        return store.load(key)",
		].join("\n"),
		"locally_shadowed_import.py": [
			"from typing import Protocol",
			"class StoreContract(Protocol):",
			"    def load(self, key: str) -> str: ...",
			"class SqlStore(StoreContract):",
			"    def load(self, key: str) -> str: return key",
			"class Loader:",
			"    def load(self, factory: type[StoreContract], key: str) -> str:",
			"        SqlStore = factory",
			"        store = SqlStore()",
			"        return store.load(key)",
		].join("\n"),
		"module_name_rebinding.py": [
			"from typing import Protocol",
			"class StoreContract(Protocol):",
			"    def load(self, key: str) -> str: ...",
			"class SqlStore(StoreContract):",
			"    def load(self, key: str) -> str: return key",
			"SqlStore = store_factory",
			"class Loader:",
			"    def load(self, key: str) -> str:",
			"        store = SqlStore()",
			"        return store.load(key)",
		].join("\n"),
	};

	test("ignores deferred, rebound, shadowed, unused, and injected Python collaborators", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			negative_python_scenarios,
		);

		expect(
			violations
				.filter((item) => item.rule_id() === "concrete-collaborator-created-per-operation")
				.map((item) => `${item.file()}:${item.line()}`),
		).toEqual([]);
	});

	test("resolves an aliased Protocol import when detecting concrete construction", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.py": [
					"from typing import Protocol as ContractBase",
					"class StoreContract(ContractBase):",
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

		expect(
			violations
				.filter((item) => item.rule_id() === "concrete-collaborator-created-per-operation")
				.map((item) => `${item.file()}:${item.line()}`),
		).toEqual(["functions.py:8"]);
	});

	test("reports implementation-only calls after a Python protocol downcast", () => {
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
					"    def load(self, store: StoreContract, key: str) -> str:",
					"        if isinstance(store, SqlStore): return store.sql_transaction()",
					"        return store.load(key)",
				].join("\n"),
			},
		);

		expect(
			violations
				.filter((item) => item.rule_id() === "protocol-downcast-to-implementation")
				.map((item) => `${item.file()}:${item.line()}`),
		).toEqual(["functions.py:9"]);
		expect(
			violations
				.filter((item) => item.rule_id() === "python-isinstance")
				.map((item) => `${item.file()}:${item.line()}`),
		).toEqual([]);
	});
});
