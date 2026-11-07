import type { BlockDeclarationNames } from "src/rules/typescript/syntax-rules/types/types";
import ts from "typescript";

/** Responsibilities: _block declaration lookup_, _lexical binding shadow detection_. **/
export class TypeScriptLocalBindingShadowing {
	private readonly _names_by_block: WeakMap<ts.Block, BlockDeclarationNames>;

	/** Responsibilities: _nested lexical scope classification_. **/
	private nested_scope(candidate: ts.Node, statement: ts.Statement): boolean {
		if (candidate === statement) {
			return false;
		}
		return ts.isBlock(candidate) || ts.isFunctionLike(candidate) || ts.isClassLike(candidate);
	}

	/** Responsibilities: _block binding lookup_. **/
	private block_declares(scope_block: ts.Block, searched_name: string): boolean {
		let names = this._names_by_block.get(scope_block);
		if (names === undefined) {
			names = this.block_declarations(scope_block);
			this._names_by_block.set(scope_block, names);
		}
		return names.has(searched_name);
	}

	/** Responsibilities: _block declaration index_. **/
	private block_declarations(scope_block: ts.Block): ReadonlySet<string> {
		const names = new Set<string>();
		for (const statement of scope_block.statements) {
			this.append_statement_declarations(statement, names);
		}
		return names;
	}

	/** Responsibilities: _statement declaration index_. **/
	private append_statement_declarations(statement: ts.Statement, names: Set<string>): void {
		const visit = (node: ts.Node): void => {
			if (this.nested_scope(node, statement)) {
				return;
			}
			if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
				names.add(node.name.text);
			}
			if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name !== undefined) {
				names.add(node.name.text);
			}
			node.forEachChild(visit);
		};
		visit(statement);
	}

	/** Responsibilities: _local declaration index initialization_. **/
	public constructor() {
		this._names_by_block = new WeakMap<ts.Block, BlockDeclarationNames>();
	}

	/** Responsibilities: _local binding shadow lookup_. **/
	public shadowed_local(local_candidate: ts.Node, local_owner: ts.Node, local_name: string): boolean {
		let current = local_candidate.parent;
		while (current !== undefined) {
			if (current === local_owner) {
				break;
			}
			if (ts.isBlock(current) && this.block_declares(current, local_name)) {
				return true;
			}
			current = current.parent;
		}
		return false;
	}

	/** Responsibilities: _parameter binding shadow lookup_. **/
	public shadowed_parameter(parameter_candidate: ts.Node, parameter_owner: ts.Node, parameter_name: string): boolean {
		if (ts.isFunctionLike(parameter_owner)) {
			for (const parameter of parameter_owner.parameters) {
				if (ts.isIdentifier(parameter.name) && parameter.name.text === parameter_name) {
					return true;
				}
			}
		}
		return this.shadowed_local(parameter_candidate, parameter_owner, parameter_name);
	}
}
