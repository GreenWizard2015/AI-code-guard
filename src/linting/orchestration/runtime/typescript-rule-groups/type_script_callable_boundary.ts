import ts from "typescript";
import { ProjectTypeBoundary } from "src/metrics/project-boundary/project_type_boundary";
import type { ProjectTypeBoundaryInput } from "src/metrics/types";
import { CONTRACT_SUFFIX, RESOLVER_SUFFIX } from "src/metrics/constants";
import { ResolvedTypeScriptDeclarationKind } from "src/module-resolution/types";
import { TYPESCRIPT_LANGUAGE } from "src/constants";
import type { ViolationContract } from "src/reporting_protocols";
import type { AstCallableNodeContract, AstClassField } from "src/types";
import type { TypeScriptScannerRuleContextContract } from "src/model/types/types";
import type { TypeScriptBoundaryAliasesContract } from "src/typescript_runtime_protocols";

/** Responsibilities: _callable type-boundary validation_, _contract import ownership_. **/
export class TypeScriptCallableBoundary {
	private readonly context: TypeScriptScannerRuleContextContract;
	private readonly aliases: TypeScriptBoundaryAliasesContract;

	/** Responsibilities: _import module resolution_. **/
	private import_module_path(source_file: ts.SourceFile, statement: ts.Statement): string {
		if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
			return "";
		}
		return this.context.module_resolver.module_symbol(source_file.fileName, statement.moduleSpecifier.text);
	}

	/** Responsibilities: _imported contract declarations_. **/
	private import_contract_names(): ReadonlySet<string> {
		const names = new Set<string>();
		const source_file = this.context.ast_file.source_file_node();
		for (const statement of source_file.statements) {
			this.add_import_contracts(names, source_file, statement);
		}
		return names;
	}

	/** Responsibilities: _resolved reference alias collection_. **/
	/** Responsibilities: _single import contract names_. **/
	private add_import_contracts(names: Set<string>, source_file: ts.SourceFile, statement: ts.Statement): void {
		const module_path = this.import_module_path(source_file, statement);
		if (module_path.length === 0 || !ts.isImportDeclaration(statement)) {
			return;
		}
		const clause = statement.importClause;
		if (clause === undefined) {
			return;
		}
		this.add_default_contract(names, clause, module_path);
		this.add_named_contracts(names, clause, module_path);
	}

	/** Responsibilities: _default import contract name_. **/
	private add_default_contract(names: Set<string>, clause: ts.ImportClause, module_path: string): void {
		if (clause.name === undefined) {
			return;
		}
		const kind = this.context.module_resolver.symbol_kind(module_path, "default");
		if (kind === ResolvedTypeScriptDeclarationKind.Contract) {
			names.add(clause.name.text);
		}
	}

	/** Responsibilities: _named import contract names_. **/
	private add_named_contracts(names: Set<string>, clause: ts.ImportClause, module_path: string): void {
		if (clause.namedBindings === undefined || !ts.isNamedImports(clause.namedBindings)) {
			return;
		}
		for (const element of clause.namedBindings.elements) {
			let imported_name = element.name.text;
			if (element.propertyName !== undefined) {
				imported_name = element.propertyName.text;
			}
			const kind = this.context.module_resolver.symbol_kind(module_path, imported_name);
			if (kind === ResolvedTypeScriptDeclarationKind.Contract) {
				names.add(element.name.text);
			}
		}
	}

	/** Responsibilities: _boundary input assembly_. **/
	private boundary_input(
		violations: ViolationContract[],
		callables: readonly AstCallableNodeContract[],
		fields: readonly AstClassField[],
	): ProjectTypeBoundaryInput {
		const source_file = this.context.ast_file.source_file_node();
		const reference_aliases = this.aliases.collect(source_file, this.context.ast.reference_aliases);
		return {
			source: { violations, file: this.context.file_name.value, callables, fields },
			names: {
				project_types: this.context.project_type_names,
				project_class_names: this.context.project_class_names,
				allowed_contracts: this.context.project_boundary_contracts,
				forbidden_project_types: this.context.project_boundary_types,
				imported_contract_names: this.import_contract_names(),
				reference_aliases,
				language: TYPESCRIPT_LANGUAGE,
			},
		};
	}

	/** Responsibilities: _public boundary field selection_. **/
	private boundary_field(field: AstClassField): boolean {
		if (field.visibility === "private") {
			return false;
		}
		if (field.type.includes(CONTRACT_SUFFIX) || field.type.includes(RESOLVER_SUFFIX)) {
			return false;
		}
		return !/^(ReadonlyMap|ReadonlySet|Map|Set|WeakMap|WeakSet)</u.test(field.type);
	}

	/** Responsibilities: _callable boundary analysis initialization_. **/
	public constructor(context: TypeScriptScannerRuleContextContract, aliases: TypeScriptBoundaryAliasesContract) {
		this.context = context;
		this.aliases = aliases;
	}

	/** Responsibilities: _callable boundary diagnostics_. **/
	public append_callables(violations: ViolationContract[], callables: readonly AstCallableNodeContract[]): void {
		if (this.context.file_name.test()) {
			return;
		}
		const input = this.boundary_input(violations, callables, []);
		const boundary = new ProjectTypeBoundary(input);
		boundary.append();
	}

	/** Responsibilities: _field boundary diagnostics_. **/
	public append_fields(violations: ViolationContract[], fields: readonly AstClassField[]): void {
		if (this.context.file_name.test()) {
			return;
		}
		const boundary_fields = fields.filter((field) => this.boundary_field(field));
		const input = this.boundary_input(violations, [], boundary_fields);
		const boundary = new ProjectTypeBoundary(input);
		boundary.append();
	}
}
