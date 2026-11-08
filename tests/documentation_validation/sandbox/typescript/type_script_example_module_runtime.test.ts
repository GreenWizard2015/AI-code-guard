import { createContext } from "node:vm";
import { describe, expect, test } from "@jest/globals";
import { DOCUMENTATION_EXAMPLE_TIMEOUT_MS } from "documentation_validation/constants";
import { TypeScriptExampleModuleCatalog } from "documentation_validation/sandbox/typescript/type_script_example_module_catalog";
import { TypeScriptExampleModuleRuntime } from "documentation_validation/sandbox/typescript/type_script_example_module_runtime";

describe("TypeScript example module runtime", () => {
	test("propagates a dependency initialization failure after later imports", () => {
		const root = "/virtual/module-runtime";
		const entry = `${root}/cli.ts`;
		const sources = new Map([
			[entry, 'import "./broken"; import "./healthy"; console.log("ready");'],
			[`${root}/broken.ts`, 'throw new Error("broken"); export {};'],
			[`${root}/healthy.ts`, "export {};"],
		]);
		const catalog = new TypeScriptExampleModuleCatalog(sources);
		const runtime = new TypeScriptExampleModuleRuntime(
			sources,
			catalog,
			createContext({ console }),
			DOCUMENTATION_EXAMPLE_TIMEOUT_MS,
		);
		runtime.entry_module(entry);

		expect(runtime.execution_error(entry)).toContain("broken");
	});

	test("executes a healthy imported module without an execution error", () => {
		const root = "/virtual/module-runtime-healthy";
		const entry = `${root}/cli.ts`;
		const sources = new Map([
			[entry, 'import "./healthy";'],
			[`${root}/healthy.ts`, "export const ready = true;"],
		]);
		const catalog = new TypeScriptExampleModuleCatalog(sources);
		const runtime = new TypeScriptExampleModuleRuntime(
			sources,
			catalog,
			createContext({ console }),
			DOCUMENTATION_EXAMPLE_TIMEOUT_MS,
		);
		runtime.entry_module(entry);

		expect(runtime.execution_error(entry)).toBe("");
	});

	test("shares the sandbox global object between imported modules", () => {
		const root = "/virtual/module-runtime-shared-global";
		const entry = `${root}/cli.ts`;
		const sources = new Map([
			[entry, 'import "./dependency"; if (globalThis.ready !== true) { throw new Error("global state was lost"); }'],
			[`${root}/dependency.ts`, "globalThis.ready = true; export {};"],
		]);
		const catalog = new TypeScriptExampleModuleCatalog(sources);
		const runtime = new TypeScriptExampleModuleRuntime(
			sources,
			catalog,
			createContext({ console }),
			DOCUMENTATION_EXAMPLE_TIMEOUT_MS,
		);
		runtime.entry_module(entry);

		expect(runtime.execution_error(entry)).toBe("");
	});

	test("stops module code that exceeds the sandbox timeout", () => {
		const root = "/virtual/module-runtime-timeout";
		const entry = `${root}/stalled.ts`;
		const sources = new Map([[entry, "while (true) {} export {};"]]);
		const catalog = new TypeScriptExampleModuleCatalog(sources);
		const runtime = new TypeScriptExampleModuleRuntime(sources, catalog, createContext({ console }), 50);
		runtime.entry_module(entry);

		expect(runtime.execution_error(entry)).toContain("Script execution timed out");
	});
});
