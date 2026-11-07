import { describe, expect, test } from "@jest/globals";
import { INSTANCE_PROPERTY_SIDE } from "src/constants";
import { TypeScriptPropertyInstanceFiles } from "src/parser/references/identity/properties/type_script_property_instance_files";
import ts from "typescript";

describe("TypeScript property instance files", () => {
	test("resolves imported class files from declared property types", () => {
		const source = ts.createSourceFile(
			"consumer.ts",
			"class Consumer { service: Service; }",
			ts.ScriptTarget.Latest,
			true,
		);
		const class_declaration = source.statements.find(ts.isClassDeclaration);
		const property = class_declaration?.members.find(ts.isPropertyDeclaration);
		const files = new TypeScriptPropertyInstanceFiles(new Map([["Service", "service.ts"]]));
		if (property !== undefined) {
			files.collect(property, "consumer.ts", "Consumer");
		}

		expect(files.file("consumer.ts", "Consumer", "service", INSTANCE_PROPERTY_SIDE)).toBe("service.ts");
	});

	test("resolves imported class files from property initializers", () => {
		const source = ts.createSourceFile(
			"consumer.ts",
			"class Consumer { service = new Service(); }",
			ts.ScriptTarget.Latest,
			true,
		);
		const class_declaration = source.statements.find(ts.isClassDeclaration);
		const property = class_declaration?.members.find(ts.isPropertyDeclaration);
		const files = new TypeScriptPropertyInstanceFiles(new Map([["Service", "service.ts"]]));
		if (property !== undefined) {
			files.collect(property, "consumer.ts", "Consumer");
		}

		expect(files.file("consumer.ts", "Consumer", "service", INSTANCE_PROPERTY_SIDE)).toBe("service.ts");
	});
});
