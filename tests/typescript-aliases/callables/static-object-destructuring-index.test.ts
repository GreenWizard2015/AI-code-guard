import { describe, expect, test } from "@jest/globals";
import ts from "typescript";
import { TypeScriptStaticExpressionBindings } from "src/typescript-aliases/callables/type_script_static_expression_bindings";

/** Responsibilities: _object source setup_, _property inventory observation_. **/
/** Responsibilities: _object source inventory_, _destructuring binding setup_. **/
class ObjectPropertyInventoryScenario {
	public readonly source_file: ts.SourceFile;
	private read_count: number;

	/** Responsibilities: _object source instrumentation_. **/
	public constructor() {
		this.source_file = ts.createSourceFile(
			"destructuring.ts",
			'const values = { first: "one", second: "two" }; const { first, second } = values;',
			ts.ScriptTarget.Latest,
			true,
		);
		this.read_count = 0;
		const source = this.source_file.statements.find(ts.isVariableStatement);
		const initializer = source?.declarationList.declarations[0]?.initializer;
		let object_literal = ts.factory.createObjectLiteralExpression();
		if (initializer !== undefined && ts.isObjectLiteralExpression(initializer)) {
			object_literal = initializer;
		}
		const properties = object_literal.properties;
		Object.defineProperty(object_literal, "properties", {
			get: () => {
				this.read_count += 1;
				return properties;
			},
		});
	}

	/** Responsibilities: _source declaration collection_. **/
	public declarations(): ts.VariableDeclaration[] {
		const declarations: ts.VariableDeclaration[] = [];
		for (const statement of this.source_file.statements.filter(ts.isVariableStatement)) {
			declarations.push(...statement.declarationList.declarations);
		}
		return declarations;
	}

	/** Responsibilities: _inventory access count_. **/
	public get inventory_read_count(): number {
		return this.read_count;
	}
}

describe("static object destructuring index", () => {
	test("reads one object property inventory for multiple bindings", () => {
		const scenario = new ObjectPropertyInventoryScenario();
		const [value, binding] = scenario.declarations();
		const bindings = new TypeScriptStaticExpressionBindings((values, name, initializer) => {
			if (!ts.isStringLiteral(initializer)) {
				return false;
			}
			values.set(name, initializer.text);
			return true;
		});
		const resolved_values = new Map<string, string>();

		if (value !== undefined && binding !== undefined) {
			bindings.append(resolved_values, value);
			bindings.append(resolved_values, binding);
		}

		expect({ values: [...resolved_values.entries()], inventory_reads: scenario.inventory_read_count }).toEqual({
			values: [
				["first", "one"],
				["second", "two"],
			],
			inventory_reads: 1,
		});
	});

	test("keeps bindings unresolved when their source is absent", () => {
		const source = ts.createSourceFile("missing.ts", "const { missing } = absent;", ts.ScriptTarget.Latest, true);
		const variable_statement = source.statements.find(ts.isVariableStatement);
		const declaration = variable_statement?.declarationList.declarations[0];
		const values = new Map<string, string>();
		const bindings = new TypeScriptStaticExpressionBindings((resolved, name, initializer) => {
			if (!ts.isStringLiteral(initializer)) {
				return false;
			}
			resolved.set(name, initializer.text);
			return true;
		});
		let changed = false;
		if (declaration !== undefined) {
			changed = bindings.append(values, declaration);
		}

		expect({ changed, values: [...values.entries()] }).toEqual({ changed: false, values: [] });
	});
});
