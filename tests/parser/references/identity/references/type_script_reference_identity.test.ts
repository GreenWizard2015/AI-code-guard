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
