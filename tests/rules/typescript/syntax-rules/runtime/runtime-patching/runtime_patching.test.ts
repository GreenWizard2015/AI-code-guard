import { describe, expect, test } from "@jest/globals";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import { RuntimePatching } from "src/rules/typescript/syntax-rules/runtime/runtime-patching/runtime_patching";
import { RuntimePatchingTestSource } from "tests/rules/typescript/syntax-rules/runtime/runtime-patching/runtime-patching-test-source";
import { TestModuleResolver } from "tests/rules/typescript/syntax-rules/test-module-resolver";
import ts from "typescript";

describe("runtime patching policy", () => {
	test("detects framework and callable replacements", () => {
		const direct_source = new RuntimePatchingTestSource('jest.spyOn(gateway, "send");');
		const direct = direct_source.analyzed_node();
		const aliased_source = new RuntimePatchingTestSource('const patch = jest.spyOn; patch(gateway, "send");');
		const aliased = aliased_source.analyzed_node();
		const assigned_source = new RuntimePatchingTestSource('gateway.send = () => "patched";');
		const assigned = assigned_source.analyzed_node();
		const rule = new RuntimePatching(new TypeScriptObjectAliasDeclarationIndex());
		const outcomes = [rule.patch_node(direct), rule.patch_node(aliased), rule.patch_node(assigned)];

		expect(outcomes).toEqual([true, true, true]);
	});

	test("detects callable and data property descriptor replacement", () => {
		const callable_source = new RuntimePatchingTestSource(
			'Object.defineProperty(gateway, "send", { value: () => "patched" });',
		);
		const callable = callable_source.analyzed_node();
		const data_source = new RuntimePatchingTestSource('Object.defineProperty(gateway, "status", { value: "fake" });');
		const data = data_source.analyzed_node();
		const rule = new RuntimePatching(new TypeScriptObjectAliasDeclarationIndex());
		const outcomes = [rule.patch_node(callable), rule.patch_node(data)];

		expect(outcomes).toEqual([true, true]);
	});

	test("detects reflective and bulk replacement", () => {
		const reflected_data_source = new RuntimePatchingTestSource('Reflect.set(gateway, "status", "fake");');
		const reflected_data = reflected_data_source.analyzed_node();
		const bulk_data_source = new RuntimePatchingTestSource('Object.assign(gateway, { status: "fake" });');
		const bulk_data = bulk_data_source.analyzed_node();
		const reflected_callable_source = new RuntimePatchingTestSource('Reflect.set(gateway, "send", () => "patched");');
		const reflected_callable = reflected_callable_source.analyzed_node();
		const bulk_callable_source = new RuntimePatchingTestSource('Object.assign(gateway, { send: () => "patched" });');
		const bulk_callable = bulk_callable_source.analyzed_node();
		const rule = new RuntimePatching(new TypeScriptObjectAliasDeclarationIndex());
		const outcomes = [
			rule.patch_node(reflected_data),
			rule.patch_node(bulk_data),
			rule.patch_node(reflected_callable),
			rule.patch_node(bulk_callable),
		];

		expect(outcomes).toEqual([true, true, true, true]);
	});

	test("allows real dependency implementations and state initialization", () => {
		const ordinary_source = new RuntimePatchingTestSource('gateway.status = "ready";');
		const ordinary = ordinary_source.analyzed_node();
		const protocol_source = new RuntimePatchingTestSource(
			"class MemoryService implements ServiceContract { send(): string { return 'fake'; } }",
		);
		const protocol = protocol_source.analyzed_node();
		const callback_source = new RuntimePatchingTestSource(
			"class Service { private readonly callback: () => string; public constructor() { this.callback = () => 'ready'; } }",
		);
		const callback = callback_source.analyzed_node();
		const rule = new RuntimePatching(new TypeScriptObjectAliasDeclarationIndex());
		const outcomes = [rule.patch_node(ordinary), rule.patch_node(protocol), rule.patch_node(callback)];

		expect(outcomes).toEqual([false, false, false]);
	});

	test.each([
		{
			import_form: "named imports",
			code: "import { Service } from 'features/latest_service'; class FakeService extends Service { override send(): string { return 'fake'; } }",
		},
		{
			import_form: "aliased named imports",
			code: "import { Service as BaseService } from 'features/latest_service'; class FakeService extends BaseService { override send(): string { return 'fake'; } }",
		},
		{
			import_form: "default imports",
			code: "import Service from 'features/latest_service'; class FakeService extends Service { override send(): string { return 'fake'; } }",
		},
		{
			import_form: "namespace imports",
			code: "import * as Services from 'features/latest_service'; class FakeService extends Services.Service { override send(): string { return 'fake'; } }",
		},
	])("detects imported class overrides through $import_form", ({ code }) => {
		const test_source = new RuntimePatchingTestSource(code);
		const source_file = ts.createSourceFile("/project/service.ts", "export class Service {}", ts.ScriptTarget.Latest);
		const project_sources = new Map([[source_file.fileName, source_file]]);
		const module_resolver = new TestModuleResolver("runtime-patching");
		const rule = new RuntimePatching(new TypeScriptObjectAliasDeclarationIndex());
		const detected = rule.patch_test_node(test_source.analyzed_node(), module_resolver, project_sources);

		expect(detected).toBe(true);
	});

	test("does not treat an external imported class as a project override", () => {
		const test_source = new RuntimePatchingTestSource(
			"import { Service } from 'external-package'; class FakeService extends Service { override send(): string { return 'fake'; } }",
		);
		const source_file = ts.createSourceFile("/project/service.ts", "export class Service {}", ts.ScriptTarget.Latest);
		const project_sources = new Map([[source_file.fileName, source_file]]);
		const module_resolver = new TestModuleResolver("runtime-patching");
		const rule = new RuntimePatching(new TypeScriptObjectAliasDeclarationIndex());
		const detected = rule.patch_test_node(test_source.analyzed_node(), module_resolver, project_sources);

		expect(detected).toBe(false);
	});
});
