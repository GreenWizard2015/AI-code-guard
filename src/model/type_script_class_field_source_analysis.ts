import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { FieldAssignment, TypeScriptClassFieldContext } from "src/model/types";
import type { ViolationContract } from "src/reporting_protocols";
import type { TypeScriptImportedFunctionAliasesContract } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _class-field import rules_, _imported callable resolution_. **/
export class TypeScriptClassFieldSourceAnalysis {
	private readonly _context: TypeScriptClassFieldContext;
	private readonly _imported_function_aliases: TypeScriptImportedFunctionAliasesContract;

	/** Responsibilities: _field import diagnostics_. **/
	private field_violation(member: ts.ClassElement, assignment: FieldAssignment): ViolationContract {
		const position = member.getStart(this._context.source_file);
		const line = this._context.source_file.getLineAndCharacterOfPosition(position).line + 1;
		const rule = new DiagnosticRule("class-field-import");
		return rule.violation(this._context.relative_file, line, {
			field: assignment.field,
			name: assignment.name,
		});
	}

	/** Responsibilities: _imported callable identity resolution_. **/
	private references_imported_function(assignment: FieldAssignment): boolean {
		const imported = this._context.imports.get(assignment.name);
		if (imported === undefined || imported.source_file === this._context.file) {
			return false;
		}
		const source_functions = this._context.functions.get(imported.source_file);
		if (source_functions === undefined) {
			return false;
		}
		return source_functions.has(imported.source_name);
	}

	/** Responsibilities: _imported function field detection_. **/
	private append_member_violation(member: ts.ClassElement, violations: ViolationContract[]): void {
		if (!ts.isPropertyDeclaration(member) || member.initializer === undefined) {
			return;
		}
		if (!ts.isIdentifier(member.name) || !ts.isIdentifier(member.initializer)) {
			return;
		}
		const assignment: FieldAssignment = { field: member.name.text, name: member.initializer.text };
		if (this.references_imported_function(assignment)) {
			violations.push(this.field_violation(member, assignment));
		}
	}

	/** Responsibilities: _class members inspection_. **/
	private append_members(members: readonly ts.ClassElement[], violations: ViolationContract[]): void {
		for (const member of members) {
			this.append_member_violation(member, violations);
		}
	}

	/** Responsibilities: _nested class field collection_. **/
	private collect_node(node: ts.Node): ViolationContract[] {
		const violations: ViolationContract[] = [];
		if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
			this.append_members(node.members, violations);
		}
		node.forEachChild((child) => violations.push(...this.collect_node(child)));
		return violations;
	}

	/** Responsibilities: _source analysis state initialization_. **/
	public constructor(
		context: TypeScriptClassFieldContext,
		imported_function_aliases: TypeScriptImportedFunctionAliasesContract,
	) {
		this._context = context;
		this._imported_function_aliases = imported_function_aliases;
	}

	/** Responsibilities: _imported callable binding presence_. **/
	public imported_functions_present(): boolean {
		return this._imported_function_aliases.imported_function_names(this._context.imports).size > 0;
	}

	/** Responsibilities: _source class-field diagnostics_. **/
	public collect(): ViolationContract[] {
		if (!this.imported_functions_present()) {
			return [];
		}
		return this.collect_node(this._context.source_file);
	}
}
