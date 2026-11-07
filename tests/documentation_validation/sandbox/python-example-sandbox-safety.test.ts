import { describe, expect, jest, test } from "@jest/globals";
import { DocumentationExampleSandbox } from "documentation_validation/sandbox/documentation_example_sandbox";
import { PythonSandboxResult } from "documentation_validation/sandbox/python/python_sandbox_result";
import type { CallableDocumentationPythonProcessRunner } from "documentation_validation/types";
import { PYTHON_SANDBOX_EXAMPLE } from "tests/documentation_validation/constants";

describe("Python example sandbox safety", () => {
	test.each([
		[
			"timeout",
			{ status: null, stdout: "", stderr: "", error: new Error("interpreter timed out") },
			"Error: interpreter timed out",
			1,
		],
		["nonzero process status", { status: 2, stdout: "partial", stderr: "interpreter stderr" }, "interpreter stderr", 2],
		[
			"malformed successful response",
			{ status: 0, stdout: "not-json", stderr: "" },
			"Python sandbox returned an invalid result.",
			1,
		],
	])("preserves useful diagnostics for a %s", (_name, result, message, exit_code) => {
		const process_result = { pid: 1, output: [], signal: null, ...result };
		const sandbox_result = new PythonSandboxResult(process_result);
		const execution = sandbox_result.execution();

		expect(execution).toMatchObject({ stdout: message, exit_code });
	});

	test("rejects Python runtime introspection before invoking the runtime", () => {
		const example = {
			...PYTHON_SANDBOX_EXAMPLE,
			source_files: [{ path: "cli.py", text: "value.__class__.__subclasses__()" }],
		};
		const python_runner_mock = jest.fn<CallableDocumentationPythonProcessRunner>();
		const sandbox = new DocumentationExampleSandbox(python_runner_mock);
		const result = sandbox.capture_output(example);

		expect({ result, ran: python_runner_mock.mock.calls.length }).toEqual({
			result: { stdout: "runtime introspection access is not allowed", exit_code: 1 },
			ran: 0,
		});
	});

	test("rejects dynamically assembled access to Python function globals", () => {
		const example = {
			...PYTHON_SANDBOX_EXAMPLE,
			source_files: [
				{ path: "domain/probe.py", text: 'object.__getattribute__(print, "__" + "globals__")' },
				{ path: "cli.py", text: "import domain.probe" },
			],
		};
		const python_runner_mock = jest.fn<CallableDocumentationPythonProcessRunner>();
		const sandbox = new DocumentationExampleSandbox(python_runner_mock);
		const result = sandbox.capture_output(example);

		expect({ result, ran: python_runner_mock.mock.calls.length }).toEqual({
			result: { stdout: "runtime introspection access is not allowed", exit_code: 1 },
			ran: 0,
		});
	});

	test("rejects Python traceback access to the sandbox frame", () => {
		const example = {
			...PYTHON_SANDBOX_EXAMPLE,
			source_files: [
				{
					path: "domain/probe.py",
					text: "try:\n    raise ValueError()\nexcept ValueError as error:\n    error.__traceback__.tb_frame.f_globals",
				},
				{ path: "cli.py", text: "import domain.probe" },
			],
		};
		const python_runner_mock = jest.fn<CallableDocumentationPythonProcessRunner>();
		const sandbox = new DocumentationExampleSandbox(python_runner_mock);
		const result = sandbox.capture_output(example);

		expect({ result, ran: python_runner_mock.mock.calls.length }).toEqual({
			result: { stdout: "runtime introspection access is not allowed", exit_code: 1 },
			ran: 0,
		});
	});

	test("rejects output written directly by a Python CLI entrypoint", () => {
		const example = {
			...PYTHON_SANDBOX_EXAMPLE,
			source_files: [{ path: "cli.py", text: 'print("ready")' }],
		};
		const python_runner_mock = jest.fn<CallableDocumentationPythonProcessRunner>();

		const sandbox = new DocumentationExampleSandbox(python_runner_mock);
		const result = sandbox.capture_output(example);

		expect(result).toEqual({
			stdout: "cli.py: CLI entrypoints must not write output",
			exit_code: 1,
		});
		expect(python_runner_mock).not.toHaveBeenCalled();
	});

	test("rejects output emitted during Python module import", () => {
		const example = {
			...PYTHON_SANDBOX_EXAMPLE,
			source_files: [
				{ path: "src/documentation_output.py", text: 'print("example")' },
				{ path: "cli.py", text: "import src.documentation_output" },
			],
		};
		const python_runner_mock = jest.fn<CallableDocumentationPythonProcessRunner>();
		const result_sandbox = new DocumentationExampleSandbox(python_runner_mock);
		const result = result_sandbox.capture_output(example);

		expect({ result, runtime_started: python_runner_mock.mock.calls.length }).toEqual({
			result: {
				stdout: "src/documentation_output.py: imported modules must write output from a called function or method",
				exit_code: 1,
			},
			runtime_started: 0,
		});
	});

	test("runs a safe Python example with the CLI source and isolated interpreter flags", () => {
		const python_runner = jest.fn<CallableDocumentationPythonProcessRunner>(() => ({
			pid: 1,
			output: [],
			stdout: JSON.stringify({ stdout: "ready\n", exit_code: 0 }),
			stderr: "",
			status: 0,
			signal: null,
		}));

		const sandbox = new DocumentationExampleSandbox(python_runner);
		const result = sandbox.capture_output(PYTHON_SANDBOX_EXAMPLE);

		expect(result).toEqual({ stdout: "ready\n", exit_code: 0 });
		expect(python_runner).toHaveBeenCalledWith(
			"python3",
			["-I", "-S", "-c", expect.any(String)],
			expect.objectContaining({ cwd: "/", env: {}, timeout: 1000 }),
		);
	});

	test("preserves isolated Python runtime errors for documentation diagnostics", () => {
		const python_runner = jest.fn<CallableDocumentationPythonProcessRunner>(() => ({
			pid: 1,
			output: [],
			stdout: JSON.stringify({ stdout: "", exit_code: 1, error: "NameError: missing value" }),
			stderr: "",
			status: 0,
			signal: null,
		}));
		const result_sandbox = new DocumentationExampleSandbox(python_runner);
		const result = result_sandbox.capture_output(PYTHON_SANDBOX_EXAMPLE);

		expect(result).toEqual({ stdout: "NameError: missing value", exit_code: 1 });
	});
});
