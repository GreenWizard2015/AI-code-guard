import { BlockVariableEscapeAnalysis } from "src/linting/orchestration/runtime/typescript-singleton/block_variable_escape_analysis";
import type { TypeScriptBlockInstanceCaptureContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _module state_, _closure ownership_. **/
export class TypeScriptBlockInstanceCapture implements TypeScriptBlockInstanceCaptureContract {
	private readonly _source_file: ts.SourceFile;

	/** Responsibilities: _variable declarations_. **/
	private append_variable_declarations(node: ts.Node, declarations: ts.VariableDeclaration[]): void {
		if (ts.isFunctionLike(node) || ts.isClassLike(node)) {
			return;
		}
		if (ts.isVariableStatement(node)) {
			declarations.push(...node.declarationList.declarations);
			return;
		}
		if (ts.isVariableDeclarationList(node)) {
			declarations.push(...node.declarations);
			return;
		}
		ts.forEachChild(node, (child) => this.append_variable_declarations(child, declarations));
	}

	/** Responsibilities: _block source initialization_. **/
	public constructor(source_file: ts.SourceFile) {
		this._source_file = source_file;
	}

	/** Responsibilities: _module variable declarations_. **/
	public module_variables(statements: readonly ts.Statement[]): ts.VariableDeclaration[] {
		const declarations: ts.VariableDeclaration[] = [];
		for (const statement of statements) {
			if (!ts.isBlock(statement)) {
				this.append_variable_declarations(statement, declarations);
			}
		}
		return declarations;
	}

	/** Responsibilities: _module variable names_. **/
	public module_variable_names(declarations: readonly ts.VariableDeclaration[]): ReadonlySet<string> {
		const names = new Set<string>();
		for (const declaration of declarations) {
			if (ts.isIdentifier(declaration.name)) {
				names.add(declaration.name.text);
			}
		}
		return names;
	}

	/** Responsibilities: _block instance variables_. **/
	public escaped_variables(block: ts.Block, names: ReadonlySet<string>): ts.VariableDeclaration[] {
		const declarations: ts.VariableDeclaration[] = [];
		this.append_variable_declarations(block, declarations);
		return declarations.filter((declaration) => {
			if (declaration.initializer === undefined || !ts.isIdentifier(declaration.name)) {
				return false;
			}
			const analysis = new BlockVariableEscapeAnalysis(this._source_file, declaration.name.text, names);
			return analysis.escapes_block(block);
		});
	}
}
