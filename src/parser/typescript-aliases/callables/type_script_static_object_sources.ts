import { StaticObjectPropertyExpansion } from "src/parser/typescript-aliases/callables/static_object_property_expansion";
import { TypeScriptStaticObjectBindingTraversal } from "src/parser/typescript-aliases/callables/type_script_static_object_binding_traversal";
import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import { TypeScriptMemberAliases } from "src/parser/typescript-aliases/type_script_member_aliases";
import { TypeScriptStaticExpressionOperations } from "src/parser/typescript-aliases/type_script_static_expression_operations";
import { TypeScriptStaticExpressionValues } from "src/parser/typescript-aliases/type_script_static_expression_values";
import type { CallableStaticObjectBranchAppender } from "src/runtime_types";
import type { StaticExpressionValuesContract } from "src/shared_services_protocols";
import type {
	TypeScriptStaticObjectAssignmentClassifierContract,
	TypeScriptStaticObjectSourcesContract,
} from "src/typescript_analysis_protocols";
import type { StaticObjectPropertyExpansionContract } from "src/typescript_analysis_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import type {
	TypeScriptMemberAliasesContract,
	TypeScriptObjectAliasDeclarationIndexContract,
	TypeScriptStaticObjectArgumentsContract,
} from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _object property source expansion_, _conditional binding source collection_. **/
export class TypeScriptStaticObjectSources
	implements TypeScriptStaticObjectSourcesContract, TypeScriptStaticObjectAssignmentClassifierContract
{
	private readonly _expression_aliases: TypeScriptExpressionAliasesContract;
	private readonly _object_aliases: TypeScriptExpressionAliasesContract;
	private readonly _object_member_aliases: TypeScriptMemberAliasesContract;
	private readonly _static_values: StaticExpressionValuesContract;
	private readonly _arguments_source: TypeScriptStaticObjectArgumentsContract;

	/** Responsibilities: _static object member names_. **/
	private member_name(expression: ts.Expression, node: ts.Node): string {
		const direct = this._object_aliases.member_name({ expression });
		if (direct !== "") {
			return direct;
		}
		if (!ts.isElementAccessExpression(expression)) {
			return "";
		}
		if (expression.argumentExpression === undefined) {
			return "";
		}
		return this._static_values.value(expression.argumentExpression, node);
	}

	/** Responsibilities: _branch operator classification_. **/
	private is_branch_operator(kind: ts.SyntaxKind): boolean {
		if (kind === ts.SyntaxKind.AmpersandAmpersandToken) {
			return true;
		}
		if (kind === ts.SyntaxKind.BarBarToken) {
			return true;
		}
		if (kind === ts.SyntaxKind.QuestionQuestionToken) {
			return true;
		}
		return kind === ts.SyntaxKind.CommaToken;
	}

	/** Responsibilities: _Object.assign argument source_. **/
	private append_argument_source(argument: ts.Expression): StaticObjectPropertyExpansionContract {
		if (!ts.isSpreadElement(argument)) {
			return this.collect_properties(argument);
		}
		const properties: ts.ObjectLiteralElementLike[] = [];
		const found = this._arguments_source.append_spread(argument, (value) => {
			const expansion = this.collect_properties(value);
			expansion.append_to(properties);
			return expansion.found();
		});
		return new StaticObjectPropertyExpansion(found, properties);
	}

	/** Responsibilities: _Object.assign source branches_. **/
	private append_call_source(initializer: ts.CallExpression): StaticObjectPropertyExpansionContract {
		if (!this.object_assign_call(initializer)) {
			return new StaticObjectPropertyExpansion(false, []);
		}
		const properties: ts.ObjectLiteralElementLike[] = [];
		let found = false;
		for (const argument of initializer.arguments) {
			const expansion = this.append_argument_source(argument);
			expansion.append_to(properties);
			if (expansion.found()) {
				found = true;
			}
		}
		return new StaticObjectPropertyExpansion(found, properties);
	}

	/** Responsibilities: _binary object branches_. **/
	private append_binary_source(initializer: ts.BinaryExpression): StaticObjectPropertyExpansionContract {
		if (!this.is_branch_operator(initializer.operatorToken.kind)) {
			return new StaticObjectPropertyExpansion(false, []);
		}
		return this.collect_properties(initializer.left).merge(this.collect_properties(initializer.right));
	}

	/** Responsibilities: _object source expression expansion_. **/
	private collect_properties(source_expression: ts.Expression): StaticObjectPropertyExpansionContract {
		const current = this._expression_aliases.unwrapped(source_expression);
		if (ts.isObjectLiteralExpression(current)) {
			return new StaticObjectPropertyExpansion(true, current.properties);
		}
		if (ts.isConditionalExpression(current)) {
			return this.collect_properties(current.whenTrue).merge(this.collect_properties(current.whenFalse));
		}
		if (ts.isCallExpression(current)) {
			return this.append_call_source(current);
		}
		if (ts.isBinaryExpression(current)) {
			return this.append_binary_source(current);
		}
		return new StaticObjectPropertyExpansion(false, []);
	}

	/** Responsibilities: _static object source dependencies_. **/
	public constructor(
		arguments_source: TypeScriptStaticObjectArgumentsContract,
		declaration_index: TypeScriptObjectAliasDeclarationIndexContract,
	) {
		this._expression_aliases = new TypeScriptExpressionAliases("", declaration_index);
		this._object_aliases = new TypeScriptExpressionAliases("Object", declaration_index);
		this._object_member_aliases = new TypeScriptMemberAliases("Object", () => "", declaration_index);
		this._static_values = new TypeScriptStaticExpressionValues(new TypeScriptStaticExpressionOperations());
		this._arguments_source = arguments_source;
	}

	/** Responsibilities: _Object.assign call classification_. **/
	public object_assign_call(expression: ts.CallExpression): boolean {
		if (ts.isIdentifier(expression.expression)) {
			return this._object_member_aliases.property({
				expression: expression.expression,
				node: expression,
				name: "assign",
			});
		}
		const member = expression.expression;
		if (!ts.isPropertyAccessExpression(member) && !ts.isElementAccessExpression(member)) {
			return false;
		}
		if (this.member_name(member, expression) !== "assign") {
			return false;
		}
		return this._object_aliases.receiver({ expression: member.expression, node: expression });
	}

	/** Responsibilities: _object source branches_. **/
	public append_properties(properties: ts.ObjectLiteralElementLike[], source_expression: ts.Expression): boolean {
		const expansion = this.collect_properties(source_expression);
		expansion.append_to(properties);
		return expansion.found();
	}

	/** Responsibilities: _object binding source traversal_. **/
	public append_binding(binding_expression: ts.Expression, append_branch: CallableStaticObjectBranchAppender): boolean {
		const current = this._expression_aliases.unwrapped(binding_expression);
		const traversal = new TypeScriptStaticObjectBindingTraversal(this._arguments_source, this, append_branch);
		return traversal.append(current);
	}

	/** Responsibilities: _object source registration_. **/
	public append_source(
		objects: Map<string, ts.ObjectLiteralExpression>,
		name: string,
		declared_expression: ts.Expression,
	): boolean {
		if (objects.has(name)) {
			return false;
		}
		const properties: ts.ObjectLiteralElementLike[] = [];
		if (!this.append_properties(properties, declared_expression)) {
			return false;
		}
		if (properties.length === 0) {
			return false;
		}
		objects.set(name, ts.factory.createObjectLiteralExpression(properties));
		return true;
	}
}
