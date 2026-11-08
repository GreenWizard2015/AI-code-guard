import type { ValueRulesContract } from "src/analysis_protocols";
import { ValueRules } from "src/linting/value_rules";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import type { BooleanExpressionContract } from "src/runtime_protocols";
import type {
	TypeScriptAssignmentValuePredicatesContract,
	TypeScriptVariableDeclarationIndexContract,
} from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _allowed assignment value classification_, _conditional assignment checks_. **/
export class TypeScriptAssignmentValuePredicates implements TypeScriptAssignmentValuePredicatesContract {
	private readonly _boolean_expression: BooleanExpressionContract;
	private readonly _value_rules: ValueRulesContract;

	private readonly _primitive_literal_kinds: Set<ts.SyntaxKind>;

	/** Responsibilities: _identification primitive literal assignment_. **/
	private primitive_literal(literal_expression: ts.Expression): boolean {
		if (this.is_literal_expression(literal_expression)) {
			return true;
		}
		return this._primitive_literal_kinds.has(literal_expression.kind);
	}

	/** Responsibilities: _identification simple default values_. **/
	private simple_default_value(default_value: ts.Expression): boolean {
		if (this.primitive_literal(default_value)) {
			return true;
		}
		if (ts.isArrayLiteralExpression(default_value)) {
			return default_value.elements.every((element) => ts.isExpression(element) && this.primitive_literal(element));
		}
		if (ts.isObjectLiteralExpression(default_value)) {
			return default_value.properties.length === 0;
		}
		return false;
	}

	/** Responsibilities: _namespace dependency default classification_. **/
	private imported_namespace_default(namespace_expression: ts.Expression): boolean {
		if (!ts.isIdentifier(namespace_expression)) {
			return false;
		}
		return namespace_expression.getSourceFile().statements.some((statement) => {
			if (!ts.isImportDeclaration(statement)) {
				return false;
			}
			const import_clause = statement.importClause;
			if (import_clause === undefined) {
				return false;
			}
			const bindings = import_clause.namedBindings;
			if (bindings === undefined || !ts.isNamespaceImport(bindings)) {
				return false;
			}
			return bindings.name.text === namespace_expression.text;
		});
	}

	/** Responsibilities: _classification literal expressions usage_. **/
	private is_literal_expression(literal_candidate: ts.Expression): boolean {
		if (ts.isStringLiteral(literal_candidate)) {
			return true;
		}
		if (ts.isNumericLiteral(literal_candidate)) {
			return true;
		}
		if (ts.isBigIntLiteral(literal_candidate)) {
			return true;
		}
		return ts.isNoSubstitutionTemplateLiteral(literal_candidate);
	}

	/** Responsibilities: _classification both sides expression_. **/
	private boolean_operands(left: ts.Expression, right: ts.Expression, boolean_source: ts.SourceFile): boolean {
		if (!this._boolean_expression.boolean_expression(left, boolean_source)) {
			return false;
		}
		return this._boolean_expression.boolean_expression(right, boolean_source);
	}

	/** Responsibilities: _classification operand primitive expression_. **/
	private primitive_operand(
		primitive_value: ts.Expression,
		value_source: ts.SourceFile,
		value_rules: ValueRulesContract,
	): boolean {
		if (this.primitive_literal(primitive_value)) {
			return true;
		}
		return value_rules.typed_primitive(primitive_value, value_source);
	}

	/** Responsibilities: _enum member value classification_. **/
	private enum_member_value(declaration: ts.EnumDeclaration, member_name: string): boolean {
		return declaration.members.some((member) => {
			if (member.name.getText() !== member_name) {
				return false;
			}
			const initializer = member.initializer;
			if (initializer === undefined) {
				return false;
			}
			return this.primitive_expression(initializer);
		});
	}

	/** Responsibilities: _default value policy_. **/
	private allowed_default(allowed_value: ts.Expression): boolean {
		if (this.simple_default_value(allowed_value)) {
			return true;
		}
		return this.imported_namespace_default(allowed_value);
	}

	/** Responsibilities: _assignment predicate dependency initialization_. **/
	public constructor(
		boolean_expression: BooleanExpressionContract,
		variable_declaration_index: TypeScriptVariableDeclarationIndexContract,
	) {
		this._primitive_literal_kinds = new Set([
			ts.SyntaxKind.NullKeyword,
			ts.SyntaxKind.TrueKeyword,
			ts.SyntaxKind.FalseKeyword,
		]);
		this._boolean_expression = boolean_expression;
		this._value_rules = new ValueRules(variable_declaration_index, new TypeScriptObjectAliasDeclarationIndex());
	}

	/** Responsibilities: _reporting assignment operand satisfies_. **/
	public operand_allowed(left: ts.Expression, right: ts.Expression, assignment_source: ts.SourceFile): boolean {
		if (this.boolean_operands(left, right, assignment_source)) {
			return true;
		}
		if (!this.primitive_operand(left, assignment_source, this._value_rules)) {
			return false;
		}
		return this.primitive_operand(right, assignment_source, this._value_rules);
	}

	/** Responsibilities: _reporting expression permitted primitive_. **/
	public primitive_expression(permitted_expression: ts.Expression): boolean {
		if (ts.isParenthesizedExpression(permitted_expression)) {
			return this.allowed_default(permitted_expression.expression);
		}
		return this.allowed_default(permitted_expression);
	}

	/** Responsibilities: _enum member default classification_. **/
	public enum_member_default(enum_access: ts.Expression): boolean {
		if (!ts.isPropertyAccessExpression(enum_access)) {
			return false;
		}
		if (!ts.isIdentifier(enum_access.expression)) {
			return false;
		}
		const enum_name = enum_access.expression.text;
		const member_name = enum_access.name.text;
		const enum_declarations = enum_access.getSourceFile().statements.filter(ts.isEnumDeclaration);
		return enum_declarations.some((declaration) => {
			if (declaration.name.text !== enum_name) {
				return false;
			}
			return this.enum_member_value(declaration, member_name);
		});
	}
}
