import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("concrete collaborator creation", () => {
	test("ignores imported collaborator calls deferred inside nested functions and lambdas", () => {
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
					"    def nested(self, key: str) -> str:",
					"        def later() -> str:",
					"            store = SqlStore()",
					"            return store.load(key)",
					"        return key",
					"    def lazy(self, key: str) -> str:",
					"        deferred = lambda: SqlStore().load(key)",
					"        return key",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "concrete-collaborator-created-per-operation")).toHaveLength(
			0,
		);
	});

	test("does not report an imported collaborator rebound before its contract call", () => {
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
					"    def load(self, replacement: StoreContract, key: str) -> str:",
					"        store = SqlStore()",
					"        store = replacement",
					"        return store.load(key)",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "concrete-collaborator-created-per-operation")).toHaveLength(
			0,
		);
	});

	test("does not resolve a shadowing Python parameter as an imported implementation", () => {
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
					"    def load(self, SqlStore, key: str) -> str:",
					"        store = SqlStore()",
					"        return store.load(key)",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "concrete-collaborator-created-per-operation")).toHaveLength(
			0,
		);
	});

	test("does not resolve a reassigned Python import alias as its original implementation", () => {
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
					"    def load(self, factory, key: str) -> str:",
					"        SqlStore = factory",
					"        store = SqlStore()",
					"        return store.load(key)",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "concrete-collaborator-created-per-operation")).toHaveLength(
			0,
		);
	});

	test("does not resolve a module-reassigned Python import as its original implementation", () => {
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
					"SqlStore = make_store()",
					"class Loader:",
					"    def load(self, key: str) -> str:",
					"        store: StoreContract = SqlStore()",
					"        return store.load(key)",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "concrete-collaborator-created-per-operation")).toHaveLength(
			0,
		);
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

		expect(violations.filter((item) => item.rule_id() === "concrete-collaborator-created-per-operation")).toHaveLength(
			1,
		);
	});

	test("accepts Python collaborator injection through its project protocol", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.py": [
					"from typing import Protocol",
					"class StoreContract(Protocol):",
					"    def load(self, key: str) -> str: ...",
					"class Loader:",
					"    def __init__(self, store: StoreContract) -> None:",
					"        self.store = store",
					"    def load(self, key: str) -> str:",
					"        return self.store.load(key)",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "concrete-collaborator-created-per-operation")).toHaveLength(
			0,
		);
	});

	test("accepts Python collaborator construction in the owning constructor", () => {
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
					"    def __init__(self) -> None:",
					"        self.store: StoreContract = SqlStore()",
					"    def load(self, key: str) -> str:",
					"        return self.store.load(key)",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "concrete-collaborator-created-per-operation")).toHaveLength(
			0,
		);
	});

	test("does not report an unused Python concrete construction", () => {
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
					"        SqlStore()",
					"        return key",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "concrete-collaborator-created-per-operation")).toHaveLength(
			0,
		);
	});

	test("does not treat a Python lambda body as an executed operation", () => {
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
					"        deferred = lambda: SqlStore().load(key)",
					"        return key",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "concrete-collaborator-created-per-operation")).toHaveLength(
			0,
		);
	});

	test("does not attribute a later Python contract call to an overwritten concrete instance", () => {
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
					"    def load(self, replacement: StoreContract, key: str) -> str:",
					"        store = SqlStore()",
					"        store = replacement",
					"        return store.load(key)",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "concrete-collaborator-created-per-operation")).toHaveLength(
			0,
		);
	});

	test("does not treat a locally shadowed Python class name as the indexed implementation", () => {
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
					"    def load(self, factory: type[StoreContract], key: str) -> str:",
					"        SqlStore = factory",
					"        store = SqlStore()",
					"        return store.load(key)",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "concrete-collaborator-created-per-operation")).toHaveLength(
			0,
		);
	});

	test("does not report a Python collaborator name rebound at module scope", () => {
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
					"SqlStore = store_factory",
					"class Loader:",
					"    def load(self, key: str) -> str:",
					"        store = SqlStore()",
					"        return store.load(key)",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "concrete-collaborator-created-per-operation")).toHaveLength(
			0,
		);
	});

	test("reports Python downcasts that call an implementation-only member", () => {
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

		expect(violations.filter((item) => item.rule_id() === "protocol-downcast-to-implementation")).toHaveLength(1);
		expect(violations.filter((item) => item.rule_id() === "python-isinstance")).toHaveLength(0);
	});
});
