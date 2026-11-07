import { describe, expect, test } from "@jest/globals";
import { TypeScriptReferenceIdentity } from "src/parser/references/identity/references/type_script_reference_identity";
import { TypeScriptReferenceIdentityFixture } from "tests/type_script_reference/type_script_reference_identity_fixture";

describe("TypeScript reference identity", () => {
	const fixture = new TypeScriptReferenceIdentityFixture();

	test("keeps factory results tied to their imported declaration file", () => {
		const root = "/virtual/factory-identity";
		const texts = {
			"first.ts": [
				"export class Service { public execute(): number { return 1; } }",
				"export function create(): Service { return new Service(); }",
			].join("\n"),
			"second.ts": "export class Service { public execute(): number { return 2; } }",
			"consumer.ts": ["import { create } from './first';", "const client = create();", "client.execute();"].join("\n"),
		};
		const source_files = fixture.source_files(root, texts);
		const consumer = fixture.required_source_file(source_files, `${root}/consumer.ts`);
		const identity_resolver = new TypeScriptReferenceIdentity(
			consumer,
			root,
			source_files,
			fixture.source_io(root, texts),
		);
		const identity = identity_resolver.method_reference(fixture.property_access(consumer, "execute"), "Service");

		expect(identity).toEqual({ name: "execute", target_file: "first.ts" });
	});

	test("resolves an inherited method to the declaring base class file", () => {
		const root = "/virtual/inherited-method-identity";
		const texts = {
			"base.ts": "export class Base { execute(): number { return 1; } }",
			"child.ts": "import { Base } from './base'; export class Child extends Base {}",
			"consumer.ts": "import { Child } from './child'; const child = new Child(); child.execute();",
		};
		const source_files = fixture.source_files(root, texts);
		const consumer = fixture.required_source_file(source_files, `${root}/consumer.ts`);
		const resolver = new TypeScriptReferenceIdentity(consumer, root, source_files, fixture.source_io(root, texts));

		expect(resolver.method_reference(fixture.property_access(consumer, "execute"), "Child")).toEqual({
			name: "execute",
			target_file: "base.ts",
		});
	});

	test("resolves a locally constructed class from the source index", () => {
		const root = "/virtual/local-class-identity";
		const texts = {
			"local.ts": [
				"class LocalService { execute(): number { return 1; } }",
				"const service = new LocalService();",
				"service.execute();",
			].join("\n"),
		};
		const source_files = fixture.source_files(root, texts);
		const local_file = fixture.required_source_file(source_files, `${root}/local.ts`);
		const resolver = new TypeScriptReferenceIdentity(local_file, root, source_files, fixture.source_io(root, texts));

		expect(resolver.method_reference(fixture.property_access(local_file, "execute"), "LocalService")).toEqual({
			name: "execute",
			target_file: "local.ts",
		});
	});

	test("resolves a nested local class while indexing its instance ownership", () => {
		const root = "/virtual/nested-local-class-identity";
		const texts = {
			"local.ts": [
				"function create_service(): void {",
				"\tclass LocalService { execute(): number { return 1; } }",
				"\tconst service = new LocalService();",
				"\tservice.execute();",
				"}",
			].join("\n"),
		};
		const source_files = fixture.source_files(root, texts);
		const local_file = fixture.required_source_file(source_files, `${root}/local.ts`);
		const resolver = new TypeScriptReferenceIdentity(local_file, root, source_files, fixture.source_io(root, texts));

		expect(resolver.method_reference(fixture.property_access(local_file, "execute"), "LocalService")).toEqual({
			name: "execute",
			target_file: "local.ts",
		});
	});

	test("keeps same-named imported parameter types tied to their declaration file", () => {
		const root = "/virtual/parameter-identity";
		const texts = {
			"first.ts": "export class Service { public execute(): number { return 1; } }",
			"second.ts": "export class Service { public execute(): number { return 2; } }",
			"consumer.ts": [
				"import { Service as First } from './first'; import { Service as Second } from './second';",
				"export function use(client: First): number { return client.execute(); }",
				"export function read(): number { const local: Second = create_second(); return local.execute(); }",
			].join("\n"),
		};
		const source_files = fixture.source_files(root, texts);
		const consumer = fixture.required_source_file(source_files, `${root}/consumer.ts`);
		const accesses = fixture.property_accesses_by_owner(consumer, "execute", new Set(["client", "local"]));
		const resolver = new TypeScriptReferenceIdentity(consumer, root, source_files, fixture.source_io(root, texts));
		const identity = {
			client: resolver.method_reference(fixture.required_property_access(accesses, "client"), "Service"),
			local: resolver.method_reference(fixture.required_property_access(accesses, "local"), "Service"),
		};

		expect(identity).toEqual({
			client: { name: "execute", target_file: "first.ts" },
			local: { name: "execute", target_file: "second.ts" },
		});
	});
});
