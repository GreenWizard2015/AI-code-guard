import { spawnSync } from "node:child_process";
import { describe, expect, test } from "@jest/globals";
import { DocumentationExampleSandbox } from "documentation_validation/sandbox/documentation_example_sandbox";
import { PythonSandboxRuntimeExampleBuilder } from "tests/bridge/ts/documentation_validation/python_sandbox_runtime_example_builder";

describe("Python documentation sandbox interpreter boundary", () => {
	test("executes relative imports from the in-memory example package", () => {
		const example_builder = new PythonSandboxRuntimeExampleBuilder();
		example_builder.add_source_file({
			path: "src/catalog/item.py",
			text: "class Item:\n    def label(self) -> str:\n        return 'relative-ready'",
		});
		example_builder.add_source_file({
			path: "src/catalog/card.py",
			text: "from .item import Item\nclass Card:\n    def report(self) -> None:\n        print(Item().label())",
		});
		example_builder.add_source_file({ path: "cli.py", text: "from src.catalog.card import Card\nCard().report()" });
		const example = example_builder.build();
		const sandbox = new DocumentationExampleSandbox(spawnSync);

		const result = sandbox.capture_output(example);

		expect(result).toEqual({ stdout: "relative-ready\n", exit_code: 0, error: "" });
	});

	test("executes dynamic imports of in-memory example modules", () => {
		const example_builder = new PythonSandboxRuntimeExampleBuilder();
		example_builder.add_source_file({ path: "src/value.py", text: "VALUE = 'dynamic-ready'" });
		example_builder.add_source_file({
			path: "src/reporter.py",
			text: "import importlib\ndef report() -> None:\n    value = importlib.import_module('src.value')\n    print(value.VALUE)",
		});
		example_builder.add_source_file({ path: "cli.py", text: "from src.reporter import report\nreport()" });
		const example = example_builder.build();
		const sandbox = new DocumentationExampleSandbox(spawnSync);

		const result = sandbox.capture_output(example);

		expect(result).toEqual({ stdout: "dynamic-ready\n", exit_code: 0, error: "" });
	});

	test("executes an ImportError fallback for a missing in-memory package module", () => {
		const example_builder = new PythonSandboxRuntimeExampleBuilder();
		example_builder.add_source_file({
			path: "src/catalog/record.py",
			text: "try:\n    from src.catalog.entry import Entry\nexcept ImportError:\n    Entry = str\nclass Record:\n    def report(self) -> None:\n        print(Entry('fallback-ready'))",
		});
		example_builder.add_source_file({
			path: "cli.py",
			text: "from src.catalog.record import Record\nRecord().report()",
		});
		const sandbox = new DocumentationExampleSandbox(spawnSync);
		const example = example_builder.build();
		const result = sandbox.capture_output(example);

		expect(result).toEqual({ stdout: "fallback-ready\n", exit_code: 0, error: "" });
	});

	test("executes literal Python attribute mutation and reads the changed value", () => {
		const example_builder = new PythonSandboxRuntimeExampleBuilder();
		example_builder.add_source_file({
			path: "src/profile.py",
			text: "class Profile:\n    def __init__(self) -> None:\n        self._label = 'pending'\n    def rename(self, label: str) -> None:\n        setattr(self, '_label', label)\n    def report(self) -> None:\n        print(getattr(self, '_label'))",
		});
		example_builder.add_source_file({
			path: "cli.py",
			text: "from src.profile import Profile\nprofile = Profile()\nprofile.rename('attribute-ready')\nprofile.report()",
		});
		const sandbox = new DocumentationExampleSandbox(spawnSync);
		const example = example_builder.build();
		const result = sandbox.capture_output(example);

		expect(result).toEqual({ stdout: "attribute-ready\n", exit_code: 0, error: "" });
	});

	test("rejects sandbox validation when a Python unittest fails", () => {
		const example_builder = new PythonSandboxRuntimeExampleBuilder();
		example_builder.add_source_file({
			path: "tests/test_value.py",
			text: "import unittest\nclass TestValue(unittest.TestCase):\n    def test_value(self) -> None:\n        self.assertEqual(1, 2)",
		});
		example_builder.add_source_file({
			path: "cli.py",
			text: "def main() -> None:\n    return None\nmain()",
		});
		const example = example_builder.build();
		const sandbox = new DocumentationExampleSandbox(spawnSync);

		const result = sandbox.capture_output(example);

		expect(result.exit_code).toBe(1);
		expect(result.stdout).toContain("Documentation test failed: tests.test_value.test_value");
	});

	test("does not parse or execute unreachable Python example modules", () => {
		const example_builder = new PythonSandboxRuntimeExampleBuilder();
		example_builder.add_source_file({ path: "src/broken.py", text: "def broken( -> str:\n    return 'invalid'" });
		example_builder.add_source_file({
			path: "src/import_configuration.py",
			text: "import sys\nsys.path.append('/tmp')",
		});
		example_builder.add_source_file({
			path: "src/report.py",
			text: "class Report:\n    def show(self) -> None:\n        print('reachable-ready')",
		});
		example_builder.add_source_file({ path: "cli.py", text: "from src.report import Report\nReport().show()" });
		const sandbox = new DocumentationExampleSandbox(spawnSync);
		const example = example_builder.build();
		const result = sandbox.capture_output(example);

		expect(result).toEqual({ stdout: "reachable-ready\n", exit_code: 0, error: "" });
	});

	test("reports the exception type and message raised by the isolated Python interpreter", () => {
		const example_builder = new PythonSandboxRuntimeExampleBuilder();
		example_builder.add_source_file({
			path: "cli.py",
			text: 'raise ValueError("python runtime exception sentinel")',
		});
		const sandbox = new DocumentationExampleSandbox(spawnSync);
		const example = example_builder.build();
		const result = sandbox.capture_output(example);

		expect(result).toEqual({
			stdout: "ValueError: python runtime exception sentinel",
			exit_code: 1,
		});
	});
});
