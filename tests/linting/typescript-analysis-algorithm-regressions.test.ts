import { describe, expect, test } from "@jest/globals";
import ts from "typescript";
import { TypeScriptBooleanExpression } from "src/parser/internals/type_script_boolean_expression";
import { TypeScriptConditionalRules } from "src/rules/typescript/syntax-rules/expressions/type_script_conditional_rules";
import { TypeScriptOverloadRules } from "src/rules/typescript/syntax-rules/callables/type_script_overload_rules";
import { ProxyCall } from "src/rules/typescript/syntax-rules/callables/proxy_call";
import { ProxyRules } from "src/rules/typescript/syntax-rules/callables/proxy_rules";
import { TypeScriptExpressionNames } from "src/typescript-aliases/type_script_expression_names";
import { TypeScriptVariableDeclarationIndex } from "src/linting/type_script_variable_declaration_index";
import { ValueRules } from "src/linting/value_rules";

/** Responsibilities: _analysis source setup_, _named binding selection_. **/
class TypeScriptAnalysisScenario {
	public readonly source_file: ts.SourceFile;
	public initializer: ts.Expression;
	public binding_found: boolean;
	public count_name: ts.Identifier;
	public enabled_name: ts.Identifier;
	public count_binding_found: boolean;
	public enabled_binding_found: boolean;

	/** Responsibilities: _source file creation_. **/
	public constructor(file: string, source_text: string) {
		this.source_file = ts.createSourceFile(file, source_text, ts.ScriptTarget.Latest, true);
		this.initializer = ts.factory.createIdentifier("missing");
		this.binding_found = false;
		this.count_name = ts.factory.createIdentifier("missing");
		this.enabled_name = ts.factory.createIdentifier("missing");
		this.count_binding_found = false;
		this.enabled_binding_found = false;
	}

	/** Responsibilities: _initializer selection_. **/
	public select_initializer(binding_name: string): void {
		for (const statement of this.source_file.statements) {
			if (!ts.isVariableStatement(statement)) {
				continue;
			}
			for (const declaration of statement.declarationList.declarations) {
				if (!ts.isIdentifier(declaration.name)) {
					continue;
				}
				if (declaration.name.text !== binding_name || declaration.initializer === undefined) {
					continue;
				}
				this.initializer = declaration.initializer;
				this.binding_found = true;
			}
		}
	}

	/** Responsibilities: _named declaration lookup_. **/
	public select_named_declarations(): void {
		for (const statement of this.source_file.statements) {
			if (!ts.isVariableStatement(statement)) {
				continue;
			}
			for (const declaration of statement.declarationList.declarations) {
				if (!ts.isIdentifier(declaration.name)) {
					continue;
				}
				if (declaration.name.text === "count") {
					this.count_name = declaration.name;
					this.count_binding_found = true;
				}
				if (declaration.name.text === "enabled") {
					this.enabled_name = declaration.name;
					this.enabled_binding_found = true;
				}
			}
		}
	}
}

describe("TypeScript analysis algorithm regressions", () => {
	test("classifies a shared boolean initializer", () => {
		const scenario = new TypeScriptAnalysisScenario("flags.ts", "const seed = true;\nconst shared = seed && seed;");
		scenario.select_initializer("shared");
		const boolean_expression = new TypeScriptBooleanExpression(new TypeScriptVariableDeclarationIndex());
		const result = boolean_expression.boolean_expression(scenario.initializer, scenario.source_file);
		expect({ binding_found: scenario.binding_found, result }).toEqual({
			binding_found: true,
			result: true,
		});
	});

	test("rejects a cyclic boolean binding", () => {
		const scenario = new TypeScriptAnalysisScenario(
			"cycle.ts",
			"const left = right;\nconst right = left;\nconst cycle = left;",
		);
		scenario.select_initializer("cycle");
		const boolean_expression = new TypeScriptBooleanExpression(new TypeScriptVariableDeclarationIndex());
		const result = boolean_expression.boolean_expression(scenario.initializer, scenario.source_file);
		expect({ binding_found: scenario.binding_found, result }).toEqual({
			binding_found: true,
			result: false,
		});
	});

	test("shares declaration results between primitive and boolean consumers", () => {
		const scenario = new TypeScriptAnalysisScenario(
			"bindings.ts",
			"const count: number = 1;\nconst enabled: boolean = true;",
		);
		scenario.select_named_declarations();
		const declaration_index = new TypeScriptVariableDeclarationIndex();
		const primitive_rules = new ValueRules(declaration_index);
		const boolean_rules = new TypeScriptBooleanExpression(declaration_index);
		const primitive_result = primitive_rules.typed_primitive(scenario.count_name, scenario.source_file);
		const boolean_result = boolean_rules.boolean_expression(scenario.enabled_name, scenario.source_file);
		const first_index = declaration_index.declarations(scenario.source_file, "count");
		const reused_index = declaration_index.declarations(scenario.source_file, "count");
		expect({
			count_binding_found: scenario.count_binding_found,
			enabled_binding_found: scenario.enabled_binding_found,
			primitive_result,
			boolean_result,
			declaration_cache_reused: first_index === reused_index,
		}).toEqual({
			count_binding_found: true,
			enabled_binding_found: true,
			primitive_result: true,
			boolean_result: true,
			declaration_cache_reused: true,
		});
	});

	test("allows interface methods without overload siblings", () => {
		const method_count = 80;
		const methods = Array.from({ length: method_count }, (_, index) => `method_${index}(): void;`).join("\n");
		const source_file = ts.createSourceFile(
			"contracts.ts",
			`interface Contract {\n${methods}\n}`,
			ts.ScriptTarget.Latest,
			true,
		);
		const declaration = source_file.statements.find(ts.isInterfaceDeclaration);
		const rules = new TypeScriptOverloadRules();
		const overloads: boolean[] = [];
		if (declaration !== undefined) {
			for (const member of declaration.members) {
				if (ts.isMethodSignature(member)) {
					overloads.push(rules.interface_method_overload(member));
				}
			}
		}
		expect({
			interface_found: declaration !== undefined,
			overloads: overloads.filter(Boolean).length,
		}).toEqual({
			interface_found: true,
			overloads: 0,
		});
	});

	test("does not classify platform API calls as forwarding functions", () => {
		const forward_count = 30;
		const source_lines = [
			'import { resolve } from "node:path";',
			...Array.from(
				{ length: forward_count },
				(_, index) => `export function forward_${index}(value: string): string { return resolve(value); }`,
			),
		];
		const source = source_lines.join("\n");
		const source_file = ts.createSourceFile("forwarders.ts", source, ts.ScriptTarget.Latest, true);
		const rules = new ProxyRules(new ProxyCall(new TypeScriptExpressionNames()));
		const forwarders = source_file.statements.filter(ts.isFunctionDeclaration);
		const classified = forwarders.map((node) => rules.proxy_callable(node));
		expect(classified).toEqual(Array.from({ length: forward_count }, () => false));
	});

	test("does not report a logical condition composed of valid calls", () => {
		const operand_count = 25;
		const operands = Array.from({ length: operand_count }, () => "is_ready()").join(" && ");
		const source_file = ts.createSourceFile(
			"conditions.ts",
			`function check(): void { if (${operands}) {} }`,
			ts.ScriptTarget.Latest,
			true,
		);
		const predicate = {
			field_assignment: (): boolean => false,
			primitive_assignment: (): boolean => false,
		};
		const rules = new TypeScriptConditionalRules(predicate, new TypeScriptVariableDeclarationIndex());
		let append_count = 0;
		/** Responsibilities: _conditional source traversal_. **/
		const visit = (node: ts.Node): void => {
			rules.append(node, source_file, () => append_count++);
			node.forEachChild(visit);
		};
		visit(source_file);
		expect(append_count).toBe(0);
	});
});
