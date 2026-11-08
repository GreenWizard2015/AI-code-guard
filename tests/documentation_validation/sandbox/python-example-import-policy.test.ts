import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { CliDocumentationValidation } from "documentation_validation/cli_documentation_validation";
import { DocumentationExampleSandbox } from "documentation_validation/sandbox/documentation_example_sandbox";
import type {
	CallableDocumentationPythonProcessRunner,
	DocumentationExampleLintContract,
} from "documentation_validation/types";
import { PYTHON_SANDBOX_EXAMPLE } from "tests/documentation_validation/constants";
import { DocumentationProjectFixture } from "tests/documentation_validation/documentation_project_fixture";

describe("Python example import policy", () => {
	let fixture = new DocumentationProjectFixture("/virtual/template-python", {});
	let python_runner = jest.fn<CallableDocumentationPythonProcessRunner>();
	let sandbox = new DocumentationExampleSandbox(python_runner);
	let linted_source_texts: string[] = [];
	let lint_runner: DocumentationExampleLintContract = {
		lint: () => [],
		with_worker: async (operation) => await operation(),
	};

	beforeEach(() => {
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
		fixture = new DocumentationProjectFixture("/virtual/template-python", {
			"docs/rules/python/empty-error-handler.md": markdown,
		});
		python_runner = jest.fn<CallableDocumentationPythonProcessRunner>(() => ({
			pid: 1,
			output: [],
			stdout: JSON.stringify({ stdout: "first\nsecond\n", exit_code: 0 }),
			stderr: "",
			status: 0,
			signal: null,
		}));
		sandbox = new DocumentationExampleSandbox(python_runner);
		linted_source_texts = [];
		lint_runner = {
			lint: (_root, _source, _rule, source_files) => {
				linted_source_texts.push(...source_files.map((source_file) => source_file.text));
				return [];
			},
			with_worker: async (operation) => await operation(),
		};
	});

	test("validates the expanded Python documentation example", () => {
		const validation_runner = new CliDocumentationValidation(
			fixture._root,
			["empty-error-handler"],
			lint_runner,
			sandbox,
			fixture._source_io,
		);
		const validation = validation_runner.validate([]);
		const good_results = validation.results.filter(({ example }) => example.kind === "Good");

		expect(
			good_results.map(({ example, passed, structural_errors }) => ({
				kind: example.kind,
				passed,
				structural_errors,
			})),
		).toEqual([{ kind: "Good", passed: true, structural_errors: [] }]);
	});

	test("sends expanded Python source to linting and execution", () => {
		const validation_runner = new CliDocumentationValidation(
			fixture._root,
			["empty-error-handler"],
			lint_runner,
			sandbox,
			fixture._source_io,
		);
		const validation = validation_runner.validate([]);
		const good_results = validation.results.filter(({ example }) => example.kind === "Good");
		const captured_input = python_runner.mock.calls.map((invocation) => String(invocation[2].input)).join("\n");
		const linted_source = linted_source_texts.join("\n");

		expect({
			good_result_count: good_results.length,
			python_invocations: python_runner.mock.calls.length,
			expanded_source: captured_input.includes('print(\\"first\\")') && captured_input.includes('print(\\"second\\")'),
			no_template_in_payload: !captured_input.includes("{{label}}"),
			first_linted: linted_source.includes('print("first")'),
			second_linted: linted_source.includes('print("second")'),
			no_template_in_lint: !linted_source.includes("{{label}}"),
		}).toEqual({
			good_result_count: 1,
			python_invocations: 1,
			expanded_source: true,
			no_template_in_payload: true,
			first_linted: true,
			second_linted: true,
			no_template_in_lint: true,
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
