import { describe, expect, test } from "@jest/globals";
import { TypeScriptCallableTypeProperties } from "src/parser/typescript-aliases/callables/type_script_callable_type_properties";
import { TypeScriptTypedCallableBindings } from "src/parser/typescript-aliases/callables/type_script_typed_callable_bindings";
import ts from "typescript";

describe("typed callable bindings", () => {
	test("collects inherited callable members from interfaces", () => {
		const source = ts.createSourceFile(
			"interface-bindings.ts",
			"interface BaseContract { run(): void; } interface DerivedContract extends BaseContract { read(): string; }",
			ts.ScriptTarget.Latest,
			true,
		);
		const interfaces = new Map<string, Set<string>>();
		const bindings = new TypeScriptTypedCallableBindings(new Map(), interfaces, new TypeScriptCallableTypeProperties());
		for (const declaration of source.statements) {
			bindings.declaration(declaration);
		}

		expect(interfaces.get("DerivedContract")).toEqual(new Set(["run", "read"]));
	});

	test("collects inherited callable members from classes", () => {
		const source = ts.createSourceFile(
			"class-bindings.ts",
			"class BaseService { save(): void {} } class DerivedService extends BaseService { load(): void {} }",
			ts.ScriptTarget.Latest,
			true,
		);
		const interfaces = new Map<string, Set<string>>();
		const bindings = new TypeScriptTypedCallableBindings(new Map(), interfaces, new TypeScriptCallableTypeProperties());
		for (const declaration of source.statements) {
			bindings.declaration(declaration);
		}

		expect(interfaces.get("DerivedService")).toEqual(new Set(["save", "load"]));
	});

	test("registers typed variables with their callable properties", () => {
		const source = ts.createSourceFile(
			"variable-bindings.ts",
			"interface CallableContract { run(): void; } const service: CallableContract = value;",
			ts.ScriptTarget.Latest,
			true,
		);
		const objects = new Map<string, Set<string>>();
		const interfaces = new Map<string, Set<string>>();
		const bindings = new TypeScriptTypedCallableBindings(objects, interfaces, new TypeScriptCallableTypeProperties());
		for (const statement of source.statements) {
			bindings.declaration(statement);
			if (!ts.isVariableStatement(statement)) {
				continue;
			}
			for (const declaration of statement.declarationList.declarations) {
				bindings.variable(declaration);
			}
		}

		expect(objects.get("service")).toEqual(new Set(["run"]));
	});
});
