import ts from "typescript";
import type { BooleanCallTarget } from "src/bridge/ts/parser-internals/types";

/** Responsibilities: _resolution boolean invocation targets_, _boolean declarations identification_. **/
export class TypeScriptBooleanCall {
	private readonly boolean_type_kind = ts.SyntaxKind.BooleanKeyword;

	/** Responsibilities: _boolean predicate naming_. **/
	private predicate_name(name: string): boolean {
		if (name.startsWith("is") || name.startsWith("has") || name.startsWith("can")) {
			return true;
		}
		if (name.startsWith("proxy_") || name.endsWith("_operator")) {
			return true;
		}
		if (name.startsWith("repeated_") || name.endsWith("_typeof")) {
			return true;
		}
		return ["some", "every", "includes", "startsWith", "endsWith", "test"].includes(name);
	}

	/** Responsibilities: _boolean declaration search_. **/
	private has_boolean_declaration(name: string, source_file: ts.SourceFile): boolean {
		let result = false;
		const visit = (child: ts.Node): void => {
			if (result) {
				return;
			}
			if (this.is_boolean_declaration(child, name, source_file)) {
				result = true;
				return;
			}
			ts.forEachChild(child, visit);
		};
		visit(source_file);
		return result;
	}

	/** Responsibilities: _boolean result declaration_. **/
	private is_boolean_declaration(node: ts.Node, name: string, source_file: ts.SourceFile): boolean {
		const is_function_declaration = ts.isFunctionDeclaration(node);
		const is_method_declaration = ts.isMethodDeclaration(node);
		if (!is_function_declaration && !is_method_declaration) {
			return false;
		}
		const has_name = node.name?.getText(source_file) === name;
		const has_boolean_type = node.type?.kind === this.boolean_type_kind;
		return has_name && has_boolean_type;
	}

	/** Responsibilities: _extraction invocation targets expression_. **/
	public call_target(expression: ts.LeftHandSideExpression): BooleanCallTarget[] {
		if (ts.isIdentifier(expression)) {
			return [{ name: expression.text, property_call: false }];
		}
		if (ts.isPropertyAccessExpression(expression)) {
			return [{ name: expression.name.text, property_call: true }];
		}
		return [];
	}

	/** Responsibilities: _boolean invocation declarations_. **/
	public boolean_call(node: ts.CallExpression, source_file: ts.SourceFile): boolean {
		const targets = this.call_target(node.expression);
		for (const target of targets) {
			if (this.predicate_name(target.name)) {
				return true;
			}
			return this.has_boolean_declaration(target.name, source_file);
		}
		return false;
	}
}
