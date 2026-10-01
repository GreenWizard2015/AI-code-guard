import ts from "typescript";

/** Responsibilities: _TypeScript overload detection_. **/
export class TypeScriptOverloadRules {
	private readonly overload_cache = new WeakMap<ts.Node, boolean>();

	/** Responsibilities: _function overload detection_. **/
	private function_overload(node: ts.FunctionDeclaration): boolean {
		if (node.body !== undefined) {
			return false;
		}
		return this.function_statements(node).some((statement) => {
			if (!ts.isFunctionDeclaration(statement)) {
				return false;
			}
			const is_other_statement = statement !== node;
			return is_other_statement && this.same_name(node, statement);
		});
	}

	/** Responsibilities: _method overload detection_. **/
	private method_overload(node: ts.MethodDeclaration): boolean {
		if (node.body !== undefined) {
			return false;
		}
		return this.class_members(node).some((member) => {
			if (!ts.isMethodDeclaration(member)) {
				return false;
			}
			const has_body = member.body !== undefined;
			return has_body && this.same_name(node, member);
		});
	}

	/** Responsibilities: _interface overload detection_. **/
	private interface_overload(node: ts.MethodSignature): boolean {
		return this.interface_members(node).some((member) => {
			if (!ts.isMethodSignature(member)) {
				return false;
			}
			const is_other_member = member !== node;
			return is_other_member && this.same_name(node, member);
		});
	}

	/** Responsibilities: _function sibling lookup_. **/
	private function_statements(node: ts.FunctionDeclaration): readonly ts.Statement[] {
		const parent = node.parent;
		if (ts.isSourceFile(parent) || ts.isModuleBlock(parent) || ts.isBlock(parent)) {
			return parent.statements;
		}
		return [];
	}

	/** Responsibilities: _class member lookup_. **/
	private class_members(node: ts.MethodDeclaration): readonly ts.ClassElement[] {
		const parent = node.parent;
		if (ts.isClassDeclaration(parent) || ts.isClassExpression(parent)) {
			return parent.members;
		}
		return [];
	}

	/** Responsibilities: _interface member lookup_. **/
	private interface_members(node: ts.MethodSignature): readonly ts.TypeElement[] {
		const parent = node.parent;
		if (ts.isInterfaceDeclaration(parent) || ts.isTypeLiteralNode(parent)) {
			return parent.members;
		}
		return [];
	}

	/** Responsibilities: _declaration name comparison_. **/
	public same_name(left: ts.NamedDeclaration, right: ts.NamedDeclaration): boolean {
		const left_name = left.name;
		const right_name = right.name;
		if (left_name === undefined) {
			return false;
		}
		if (right_name === undefined) {
			return false;
		}
		return left_name.getText() === right_name.getText();
	}

	/** Responsibilities: _overload declaration detection_. **/
	public overload(node: ts.Node): boolean {
		const cached = this.overload_cache.get(node);
		if (cached !== undefined) {
			return cached;
		}
		let result = false;
		if (ts.isFunctionDeclaration(node)) {
			result = this.function_overload(node);
		} else if (ts.isMethodDeclaration(node)) {
			result = this.method_overload(node);
		} else if (ts.isMethodSignature(node)) {
			result = this.interface_overload(node);
		}
		this.overload_cache.set(node, result);
		return result;
	}
}
