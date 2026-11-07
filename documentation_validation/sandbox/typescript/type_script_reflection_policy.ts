import {
	TYPESCRIPT_REFLECTION_METHOD_NAMES,
	TYPESCRIPT_REFLECTIVE_PROPERTY_NAMES,
} from "documentation_validation/constants";
import type { TypeScriptReflectionPolicyContract } from "documentation_validation/protocols";
import { TYPESCRIPT_PROTOTYPE_NAME, TYPESCRIPT_SAFE_OBJECT_METHOD_NAMES } from "src/constants";
import ts from "typescript";

/** Responsibilities: _reflection access policy_, _safe prototype operations_. **/
export class TypeScriptReflectionPolicy implements TypeScriptReflectionPolicyContract {
	private readonly _path: string;
	private readonly _source: ts.SourceFile;

	/** Responsibilities: _local class name lookup_. **/
	private class_declared(class_name: string): boolean {
		for (const statement of this._source.statements) {
			if (!ts.isClassDeclaration(statement) || statement.name === undefined) {
				continue;
			}
			if (statement.name.text === class_name) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _prototype member assignment classification_. **/
	private is_member_assignment(prototype_member: ts.PropertyAccessExpression): boolean {
		const member_access = prototype_member.parent;
		if (!ts.isPropertyAccessExpression(member_access)) {
			return false;
		}
		const assignment = member_access.parent;
		if (!ts.isBinaryExpression(assignment) || assignment.left !== member_access) {
			return false;
		}
		return assignment.operatorToken.kind === ts.SyntaxKind.EqualsToken;
	}

	/** Responsibilities: _local prototype assignment recognition_. **/
	private local_prototype_write(prototype_member: ts.PropertyAccessExpression): boolean {
		if (prototype_member.name.text !== TYPESCRIPT_PROTOTYPE_NAME) {
			return false;
		}
		if (!ts.isIdentifier(prototype_member.expression)) {
			return false;
		}
		if (!this.is_member_assignment(prototype_member)) {
			return false;
		}
		return this.class_declared(prototype_member.expression.text);
	}

	/** Responsibilities: _Object prototype method classification_. **/
	private object_prototype_method(prototype_access: ts.PropertyAccessExpression): boolean {
		if (prototype_access.name.text !== TYPESCRIPT_PROTOTYPE_NAME) {
			return false;
		}
		if (!ts.isIdentifier(prototype_access.expression) || prototype_access.expression.text !== "Object") {
			return false;
		}
		const method = prototype_access.parent;
		if (!ts.isPropertyAccessExpression(method) || method.expression !== prototype_access) {
			return false;
		}
		return TYPESCRIPT_SAFE_OBJECT_METHOD_NAMES.has(method.name.text);
	}

	/** Responsibilities: _Object prototype call classification_. **/
	private safe_prototype_call(method: ts.PropertyAccessExpression): boolean {
		if (!TYPESCRIPT_SAFE_OBJECT_METHOD_NAMES.has(method.name.text)) {
			return false;
		}
		if (!ts.isPropertyAccessExpression(method.expression)) {
			return false;
		}
		const prototype = method.expression;
		if (prototype.name.text !== TYPESCRIPT_PROTOTYPE_NAME || !ts.isIdentifier(prototype.expression)) {
			return false;
		}
		return prototype.expression.text === "Object";
	}

	/** Responsibilities: _Object call method classification_. **/
	private object_call_method(call_access: ts.PropertyAccessExpression): boolean {
		if (call_access.name.text !== "call") {
			return false;
		}
		if (!ts.isPropertyAccessExpression(call_access.expression)) {
			return false;
		}
		return this.safe_prototype_call(call_access.expression);
	}

	/** Responsibilities: _safe Object method classification_. **/
	private safe_object_tag(property_access: ts.PropertyAccessExpression): boolean {
		if (this.object_prototype_method(property_access)) {
			return true;
		}
		return this.object_call_method(property_access);
	}

	/** Responsibilities: _computed reflection key extraction_. **/
	private computed_property(element_access: ts.ElementAccessExpression): string {
		const argument = element_access.argumentExpression;
		if (argument === undefined) {
			return "";
		}
		if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
			return argument.text;
		}
		return "";
	}

	/** Responsibilities: _named reflection diagnostic_. **/
	private property_access_issue(property_access: ts.PropertyAccessExpression): string {
		if (TYPESCRIPT_REFLECTION_METHOD_NAMES.has(property_access.name.text)) {
			return `${this._path}: runtime prototype inspection is not allowed`;
		}
		if (!TYPESCRIPT_REFLECTIVE_PROPERTY_NAMES.has(property_access.name.text)) {
			return "";
		}
		if (this.safe_object_tag(property_access)) {
			return "";
		}
		if (this.local_prototype_write(property_access)) {
			return "";
		}
		return `${this._path}: reflective property access is not allowed`;
	}

	/** Responsibilities: _computed reflection diagnostic_. **/
	private element_access_issue(element_access: ts.ElementAccessExpression): string {
		const property = this.computed_property(element_access);
		if (TYPESCRIPT_REFLECTION_METHOD_NAMES.has(property)) {
			return `${this._path}: runtime prototype inspection is not allowed`;
		}
		if (TYPESCRIPT_REFLECTIVE_PROPERTY_NAMES.has(property)) {
			return `${this._path}: reflective property access is not allowed`;
		}
		return "";
	}

	/** Responsibilities: _reflection policy setup_. **/
	public constructor(path: string, source: ts.SourceFile) {
		this._path = path;
		this._source = source;
	}

	/** Responsibilities: _reflection diagnostics_. **/
	public issues(): readonly string[] {
		const issues: string[] = [];
		const visit = (node: ts.Node): void => {
			if (ts.isPropertyAccessExpression(node)) {
				const issue = this.property_access_issue(node);
				if (issue.length > 0) {
					issues.push(issue);
				}
			}
			if (ts.isElementAccessExpression(node)) {
				const issue = this.element_access_issue(node);
				if (issue.length > 0) {
					issues.push(issue);
				}
			}
			ts.forEachChild(node, visit);
		};
		visit(this._source);
		return issues;
	}
}
