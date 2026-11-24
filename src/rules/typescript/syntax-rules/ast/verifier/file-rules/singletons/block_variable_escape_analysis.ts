import ts from "typescript";

/** Responsibilities: _block variable lifetime_, _module assignment ownership_. **/
export class BlockVariableEscapeAnalysis {
	private readonly _source_file: ts.SourceFile;
	private readonly _variable_name: string;
	private readonly _module_names: ReadonlySet<string>;

	/** Responsibilities: _identifier occurrence_. **/
	private references_name(body: ts.ConciseBody, name: string): boolean {
		let found = false;
		const visit = (node: ts.Node): void => {
			if (found) {
				return;
			}
			if (!ts.isIdentifier(node)) {
				ts.forEachChild(node, visit);
				return;
			}
			if (node.text === name) {
				found = true;
				return;
			}
			ts.forEachChild(node, visit);
		};
		visit(body);
		return found;
	}

	/** Responsibilities: _module assignment target_. **/
	private assigns_module_variable(function_node: ts.Node): boolean {
		if (function_node.getSourceFile() !== this._source_file) {
			return false;
		}
		const parent = function_node.parent;
		if (!ts.isBinaryExpression(parent)) {
			return false;
		}
		if (parent.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return false;
		}
		return ts.isIdentifier(parent.left) && this._module_names.has(parent.left.text);
	}

	/** Responsibilities: _function lexical scope_. **/
	public constructor(source_file: ts.SourceFile, variable_name: string, module_names: ReadonlySet<string>) {
		this._source_file = source_file;
		this._variable_name = variable_name;
		this._module_names = module_names;
	}

	/** Responsibilities: _function reference state_. **/
	public escapes(function_node: ts.Node): boolean {
		let body: ts.ConciseBody;
		if (ts.isArrowFunction(function_node) || ts.isFunctionExpression(function_node)) {
			body = function_node.body;
		} else if (ts.isFunctionDeclaration(function_node) || ts.isMethodDeclaration(function_node)) {
			if (function_node.body === undefined) {
				return false;
			}
			body = function_node.body;
		} else {
			return false;
		}
		if (!this.references_name(body, this._variable_name)) {
			return false;
		}
		return this.assigns_module_variable(function_node);
	}

	/** Responsibilities: _block closure references_. **/
	public escapes_block(block: ts.Block): boolean {
		let escaped = false;
		const visit = (node: ts.Node): void => {
			if (escaped) {
				return;
			}
			if (ts.isFunctionLike(node)) {
				if (this.escapes(node)) {
					escaped = true;
				}
				return;
			}
			ts.forEachChild(node, visit);
		};
		visit(block);
		return escaped;
	}
}
