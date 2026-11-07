import type { ValueRulesContract } from "src/analysis_protocols";
import { TYPE_SCRIPT_CALLABLE_BODY_KINDS } from "src/constants";
import { PrimitivePropertySearch } from "src/linting/primitive_property_search";
import { TypeScriptVariableBinding } from "src/linting/type_script_variable_binding";
import { TypeScriptCallableBody } from "src/parser/typescript-aliases/callables/type_script_callable_body";
import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import type { SourceFileBooleanMapCache } from "src/source_types";
import type { TypeScriptVariableDeclarationIndexContract } from "src/typescript_analysis_protocols";
import type { TypeScriptObjectAliasDeclarationIndexContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _object value checks_, _primitive property analysis_. **/
export class ValueRules implements ValueRulesContract {
	private readonly _type_aliases: TypeScriptExpressionAliases;
	private readonly _variable_bindings: Map<ts.SourceFile, TypeScriptVariableBinding>;
	private readonly _variable_declaration_index: TypeScriptVariableDeclarationIndexContract;
	private readonly _primitive_properties: SourceFileBooleanMapCache;
	private readonly _callable_body: TypeScriptCallableBody;

	/** Responsibilities: _selection value rules applicable_. **/
	/** Responsibilities: _typeof expression count_. **/
	private typeof_subject(expression: ts.Expression): string {
		let subject = expression;
		while (ts.isParenthesizedExpression(subject)) {
			subject = subject.expression;
		}
		return subject.getText(subject.getSourceFile());
	}

	/** Responsibilities: _matching typeof subject count_. **/
	private count_typeof_expressions(root: ts.Node, subject: string): number {
		let count = 0;
		const visit = (child: ts.Node): void => {
			if (ts.isTypeOfExpression(child) && this.typeof_subject(child.expression) === subject) {
				count += 1;
			}
			ts.forEachChild(child, visit);
		};
		visit(root);
		return count;
	}

	/** Responsibilities: _primitive property classification_. **/
	private property_type(source_file: ts.SourceFile, name: string): boolean {
		let cached = this._primitive_properties.get(source_file);
		if (cached === undefined) {
			cached = new Map<string, boolean>();
			this._primitive_properties.set(source_file, cached);
		}
		const cached_result = cached.get(name);
		if (cached_result !== undefined) {
			return cached_result;
		}
		const search = new PrimitivePropertySearch(source_file, name);
		const found = search.find();
		cached.set(name, found);
		return found;
	}

	/** Responsibilities: _value rule dependency initialization_. **/
	public constructor(
		variable_declaration_index: TypeScriptVariableDeclarationIndexContract,
		declaration_index: TypeScriptObjectAliasDeclarationIndexContract,
	) {
		this._type_aliases = new TypeScriptExpressionAliases("type", declaration_index);
		this._variable_bindings = new Map<ts.SourceFile, TypeScriptVariableBinding>();
		this._variable_declaration_index = variable_declaration_index;
		this._primitive_properties = new WeakMap<ts.SourceFile, Map<string, boolean>>();
		this._callable_body = new TypeScriptCallableBody(TYPE_SCRIPT_CALLABLE_BODY_KINDS);
	}

	/** Responsibilities: _reporting repeated typeof checks_. **/
	public repeated_typeof(node: ts.TypeOfExpression): boolean {
		let owner: ts.Node | undefined = node.parent;
		while (owner !== undefined) {
			if (ts.isFunctionLike(owner)) {
				break;
			}
			owner = owner.parent;
		}
		if (owner === undefined) {
			return false;
		}
		const subject = this.typeof_subject(node.expression);
		return this._callable_body.resolve(owner, false, (body) => this.count_typeof_expressions(body, subject) > 1);
	}

	/** Responsibilities: _reporting primitive type operations_. **/
	public typed_primitive(expression: ts.Expression, source_file: ts.SourceFile): boolean {
		if (ts.isParenthesizedExpression(expression)) {
			return this.typed_primitive(expression.expression, source_file);
		}
		if (ts.isIdentifier(expression)) {
			let bindings = this._variable_bindings.get(source_file);
			if (bindings === undefined) {
				bindings = new TypeScriptVariableBinding(source_file, this._variable_declaration_index);
				this._variable_bindings.set(source_file, bindings);
			}
			return bindings.primitive(expression.text, expression);
		}
		if (ts.isPropertyAccessExpression(expression)) {
			return this.property_type(source_file, expression.name.text);
		}
		return false;
	}

	/** Responsibilities: _reporting dynamic class checks_. **/
	public dynamic_class(node: ts.Node): boolean {
		if (!ts.isCallExpression(node)) {
			return false;
		}
		if (!ts.isIdentifier(node.expression)) {
			return false;
		}
		return this._type_aliases.receiver({ expression: node.expression, node });
	}
}
