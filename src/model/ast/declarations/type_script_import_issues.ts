import { IMPORT_KINDS } from "src/constants";
import type { AstImportIssue } from "src/model/ast/normalized_ast_types";
import type { TypeScriptNodeImportIssuesContract } from "src/model/protocols";
import type { CallableLineOf } from "src/parser/types";
import type { AstImportIssueFlags } from "src/types";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _import diagnostics_, _import positions_. **/
export class TypeScriptImportIssues implements TypeScriptNodeImportIssuesContract {
	private readonly _import_kinds: ReadonlySet<ts.SyntaxKind>;
	private readonly _require_aliases: TypeScriptExpressionAliasesContract;

	/** Responsibilities: _relative module name classification_. **/
	private relative_module_name(module_name: string): boolean {
		if (module_name === "." || module_name === "..") {
			return true;
		}
		return module_name.startsWith("./") || module_name.startsWith("../");
	}

	/** Responsibilities: _import declaration path classification_. **/
	private relative_import_declaration(declaration: ts.ImportDeclaration): boolean {
		if (!ts.isStringLiteral(declaration.moduleSpecifier)) {
			return false;
		}
		return this.relative_module_name(declaration.moduleSpecifier.text);
	}

	/** Responsibilities: _import assignment path classification_. **/
	private relative_import_equals(declaration: ts.ImportEqualsDeclaration): boolean {
		if (!ts.isExternalModuleReference(declaration.moduleReference)) {
			return false;
		}
		const expression = declaration.moduleReference.expression;
		if (!ts.isStringLiteral(expression)) {
			return false;
		}
		return this.relative_module_name(expression.text);
	}

	/** Responsibilities: _creation normalization import issues_. **/
	private create_import_issues(line: number, flags: AstImportIssueFlags): AstImportIssue[] {
		const issues: AstImportIssue[] = [];
		if (flags.dynamic) {
			issues.push({ line, kind: "dynamic" });
		}
		if (flags.nested) {
			issues.push({ line, kind: "nested" });
		}
		if (flags.relative) {
			issues.push({ line, kind: "relative" });
		}
		return issues;
	}

	/** Responsibilities: _nested import classification_. **/
	private nested_import(parent: ts.Node, is_import_kind: boolean): boolean {
		if (!is_import_kind) {
			return false;
		}
		return !ts.isSourceFile(parent);
	}

	/** Responsibilities: _dynamic import classification_. **/
	private dynamic_import(kind: ts.SyntaxKind, is_dynamic_call: boolean): boolean {
		if (kind === ts.SyntaxKind.ImportType) {
			return true;
		}
		return is_dynamic_call;
	}

	/** Responsibilities: _dynamic call classification_. **/
	private dynamic_call(call: ts.CallExpression): boolean {
		if (call.expression.kind === ts.SyntaxKind.ImportKeyword) {
			return true;
		}
		if (!ts.isIdentifier(call.expression)) {
			return false;
		}
		return this._require_aliases.receiver({ expression: call.expression, node: call });
	}

	/** Responsibilities: _import issue classification initialization_. **/
	public constructor(require_aliases: TypeScriptExpressionAliasesContract) {
		this._import_kinds = IMPORT_KINDS;
		this._require_aliases = require_aliases;
	}
	/** Responsibilities: _public operation_. **/
	public late_import_issues(source_file: ts.SourceFile, line_of: CallableLineOf): AstImportIssue[] {
		let imports_closed = false;
		const issues: AstImportIssue[] = [];
		for (const statement of source_file.statements) {
			if (this._import_kinds.has(statement.kind)) {
				if (imports_closed) {
					issues.push({
						line: line_of(statement.getStart(source_file)),
						kind: "late",
					});
				}
				continue;
			}
			imports_closed = true;
		}
		return issues;
	}

	/** Responsibilities: _collection import issues represented_. **/
	public node_import_issues(node: ts.Node, line: number): AstImportIssue[] {
		const is_dynamic_call = ts.isCallExpression(node) && this.dynamic_call(node);
		const dynamic = this.dynamic_import(node.kind, is_dynamic_call);
		const nested = this.nested_import(node.parent, this._import_kinds.has(node.kind));
		let relative = false;
		if (ts.isImportDeclaration(node)) {
			relative = this.relative_import_declaration(node);
		}
		if (ts.isImportEqualsDeclaration(node)) {
			relative = this.relative_import_equals(node);
		}
		return this.create_import_issues(line, { dynamic, nested, relative });
	}
}
