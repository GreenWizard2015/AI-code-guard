import { describe, expect, jest, test } from "@jest/globals";
import { CliDocumentationValidation } from "documentation_validation/cli_documentation_validation";
import { DocumentationExampleSandbox } from "documentation_validation/sandbox/documentation_example_sandbox";
import type {
	CallableDocumentationPythonProcessRunner,
	DocumentationExampleLintContract,
} from "documentation_validation/types";
import { PYTHON_SANDBOX_EXAMPLE } from "tests/documentation_validation/constants";
import { DocumentationProjectFixture } from "tests/documentation_validation/documentation_project_fixture";

describe("Python example import policy", () => {
	test("passes expanded Python source to the interpreter payload", () => {
		const markdown = [
			"# empty-error-handler",
			"## Good",
			"```py",
			"# File: domain/output.py",
			"class Output:",
			"    def report(self) -> None:",
			'        {% const labels = ["first", "second"] %}',
			"        {% for label in labels %}",
			'        print("{{label}}")',
			"        {% endfor %}",
			"",
			"# File: cli.py",
			"from domain.output import Output",
			"output = Output()",
			"output.report()",
			"```",
		].join("\n");
		const fixture = new DocumentationProjectFixture("/virtual/template-python", {
			"docs/rules/python/empty-error-handler.md": markdown,
		});
		const python_runner = jest.fn<CallableDocumentationPythonProcessRunner>(() => ({
			pid: 1,
			output: [],
			stdout: JSON.stringify({ stdout: "first\nsecond\n", exit_code: 0 }),
			stderr: "",
			status: 0,
			signal: null,
		}));
		const sandbox = new DocumentationExampleSandbox(python_runner);
		const linted_source_texts: string[] = [];
		const lint_runner: DocumentationExampleLintContract = {
			lint: (_root, _source, _rule, source_files) => {
				linted_source_texts.push(...source_files.map((source_file) => source_file.text));
				return [];
			},
			with_worker: async (operation) => await operation(),
		};
		const validation = new CliDocumentationValidation(
			fixture._root,
			["empty-error-handler"],
			lint_runner,
			sandbox,
			fixture._source_io,
		);
		const result = validation.validate([]).results.find(({ example }) => example.kind === "Good");
		let captured_input = "";
		for (const invocation of python_runner.mock.calls) {
			captured_input = String(invocation[2].input);
		}

		expect({
			passed: result?.passed,
			structural_errors: result?.structural_errors,
			python_invocations: python_runner.mock.calls.length,
			expanded_first: captured_input.includes('print(\\"first\\")'),
			expanded_second: captured_input.includes('print(\\"second\\")'),
			unexpanded_template: captured_input.includes("{{label}}"),
			linted_first: linted_source_texts.some((text) => text.includes('print("first")')),
			linted_second: linted_source_texts.some((text) => text.includes('print("second")')),
			linted_template: linted_source_texts.some((text) => text.includes("{{label}}")),
		}).toEqual({
			passed: true,
			structural_errors: [],
			python_invocations: 1,
			expanded_first: true,
			expanded_second: true,
			unexpanded_template: false,
			linted_first: true,
			linted_second: true,
			linted_template: false,
		});
	});

	test("rejects Python network access before invoking the runtime", () => {
		const example = {
			...PYTHON_SANDBOX_EXAMPLE,
			source_files: [{ path: "cli.py", text: "if True: import socket" }],
		};
		const python_runner_mock = jest.fn<CallableDocumentationPythonProcessRunner>();

		const sandbox = new DocumentationExampleSandbox(python_runner_mock);
		const result = sandbox.capture_output(example);

		expect(result).toEqual({
			stdout: "socket: external module access is not allowed",
			exit_code: 1,
		});
		expect(python_runner_mock).not.toHaveBeenCalled();
	});

	test("allows unittest contracts without enabling discovery APIs", () => {
		const example = {
			...PYTHON_SANDBOX_EXAMPLE,
			source_files: [
				{
					path: "tests/test_value.py",
					text: "import unittest\nclass TestValue(unittest.TestCase):\n    pass",
				},
				{ path: "cli.py", text: "import tests.test_value" },
			],
		};
		const python_runner_mock = jest.fn<CallableDocumentationPythonProcessRunner>(() => ({
			pid: 1,
			output: [],
			stdout: JSON.stringify({ stdout: "ready\n", exit_code: 0 }),
			stderr: "",
			status: 0,
			signal: null,
		}));
		const result_sandbox = new DocumentationExampleSandbox(python_runner_mock);
		const result = result_sandbox.capture_output(example);

		expect({ result, runner_calls: python_runner_mock.mock.calls.length }).toEqual({
			result: { stdout: "ready\n", exit_code: 0 },
			runner_calls: 1,
		});
		expect(python_runner_mock).toHaveBeenCalledWith(
			"python3",
			expect.any(Array),
			expect.objectContaining({ input: expect.stringContaining('"tests/test_value.py"') }),
		);
	});

	test("rejects submodule access through an allowed Python standard module", () => {
		const example = {
			...PYTHON_SANDBOX_EXAMPLE,
			source_files: [{ path: "cli.py", text: "import dataclasses.sys" }],
		};
		const python_runner_mock = jest.fn<CallableDocumentationPythonProcessRunner>();
		const sandbox = new DocumentationExampleSandbox(python_runner_mock);
		const result = sandbox.capture_output(example);

		expect(result).toEqual({
			stdout: "dataclasses.sys: external module access is not allowed",
			exit_code: 1,
		});
		expect(python_runner_mock).not.toHaveBeenCalled();
	});

	test("rejects literal Python dynamic imports outside example modules", () => {
		const example = {
			...PYTHON_SANDBOX_EXAMPLE,
			source_files: [
				{ path: "domain/probe.py", text: 'import importlib\nimportlib.import_module("os")' },
				{ path: "cli.py", text: "import domain.probe" },
			],
		};
		const python_runner_mock = jest.fn<CallableDocumentationPythonProcessRunner>();
		const sandbox = new DocumentationExampleSandbox(python_runner_mock);
		const result = sandbox.capture_output(example);

		expect({ result, ran: python_runner_mock.mock.calls.length }).toEqual({
			result: { stdout: "os: dynamic imports must target an example source module", exit_code: 1 },
			ran: 0,
		});
	});

	test("rejects Python file access before invoking the runtime", () => {
		const example = {
			...PYTHON_SANDBOX_EXAMPLE,
			source_files: [{ path: "cli.py", text: 'open("/tmp/example", "w")' }],
		};
		const python_runner_mock = jest.fn<CallableDocumentationPythonProcessRunner>();
		const sandbox = new DocumentationExampleSandbox(python_runner_mock);
		const result = sandbox.capture_output(example);

		expect(result).toEqual({
			stdout: "file, dynamic-code, and input operations are not allowed",
			exit_code: 1,
		});
		expect(python_runner_mock).not.toHaveBeenCalled();
	});

	test("allows normal Python dunder methods", () => {
		const example = {
			...PYTHON_SANDBOX_EXAMPLE,
			source_files: [
				{
					path: "domain/service.py",
					text: 'from __future__ import annotations\n\nclass Service:\n    def __init__(self):\n        self.label = "ready"',
				},
				{ path: "cli.py", text: "from domain.service import Service\nService()" },
			],
		};
		const python_runner_mock = jest.fn<CallableDocumentationPythonProcessRunner>(() => ({
			pid: 1,
			output: [],
			stdout: JSON.stringify({ stdout: "ready\n", exit_code: 0 }),
			stderr: "",
			status: 0,
			signal: null,
		}));
		const sandbox = new DocumentationExampleSandbox(python_runner_mock);
		const result = sandbox.capture_output(example);

		expect({ result, ran: python_runner_mock.mock.calls.length }).toEqual({
			result: { stdout: "ready\n", exit_code: 0 },
			ran: 1,
		});
	});
});
