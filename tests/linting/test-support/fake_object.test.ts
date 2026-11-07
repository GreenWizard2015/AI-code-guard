import { describe, expect, test } from "@jest/globals";
import { ExternalImportedTypes } from "src/linting/test-support/external_imported_types";
import { FakeObject } from "src/linting/test-support/fake_object";
import ts from "typescript";

describe("fake object classification", () => {
	test("reports callable objects passed to a call", () => {
		const source_file = ts.createSourceFile(
			"callable-call-argument.ts",
			"declare const receiver: { register(value: object): void }; receiver.register({ run() {} });",
			ts.ScriptTarget.Latest,
			true,
		);
		const fake_object = new FakeObject(new ExternalImportedTypes());
		let violation = false;
		for (const statement of source_file.statements) {
			if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) {
				continue;
			}
			for (const argument of statement.expression.arguments) {
				if (ts.isObjectLiteralExpression(argument)) {
					violation = fake_object.fake_object(argument);
				}
			}
		}

		expect(violation).toBe(true);
	});

	test("reports module-level callable objects", () => {
		const source_file = ts.createSourceFile(
			"module-callable-object.ts",
			"export const MODULE_SERVICE = { run() {} };",
			ts.ScriptTarget.Latest,
			true,
		);
		const fake_object = new FakeObject(new ExternalImportedTypes());
		let violation = false;
		for (const statement of source_file.statements) {
			if (!ts.isVariableStatement(statement)) {
				continue;
			}
			for (const declaration of statement.declarationList.declarations) {
				const initializer = declaration.initializer;
				if (initializer !== undefined && ts.isObjectLiteralExpression(initializer)) {
					violation = fake_object.fake_object(initializer);
				}
			}
		}

		expect(violation).toBe(true);
	});

	test("accepts object literals without callable members", () => {
		const source_file = ts.createSourceFile(
			"data-objects.ts",
			"const metadata = { name: 'sample', count: 2 };",
			ts.ScriptTarget.Latest,
			true,
		);
		const fake_object = new FakeObject(new ExternalImportedTypes());
		let classifier_ran = false;
		let is_fake_object = true;
		for (const statement of source_file.statements) {
			if (!ts.isVariableStatement(statement)) {
				continue;
			}
			for (const declaration of statement.declarationList.declarations) {
				const initializer = declaration.initializer;
				if (initializer !== undefined && ts.isObjectLiteralExpression(initializer)) {
					classifier_ran = true;
					is_fake_object = fake_object.fake_object(initializer);
				}
			}
		}
		expect({ classifier_ran, is_fake_object }).toEqual({ classifier_ran: true, is_fake_object: false });
	});
});
