import { resolve } from "node:path";
import {
	FUNCTIONS_FILE_TYPE_DECLARATION_RULE,
	FUNCTION_MODULE_NAMES,
	MAX_IMPORT_FAN_OUT,
	NODE_EXECUTABLE_SHEBANG,
	RESPONSIBILITY_ACTION_EXTENSIONS,
	RESPONSIBILITY_ACTION_WORDS,
	RESPONSIBILITY_CONDITION_WORDS,
	RESPONSIBILITY_NOUN_WORDS,
} from "src/constants";
import { LintFileName } from "src/core/context/lint_file_name";
import type { NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ViolationContract } from "src/reporting_protocols";
import { FunctionPlacementRules } from "src/rules/architecture/function_placement_rules";
import { ResponsibilityRules } from "src/rules/architecture/responsibility_rules";
import { ResponsibilityWording } from "src/rules/architecture/responsibility_wording";
import type { ModulePlacementContext } from "src/rules/architecture/types";
import { SingletonCollector } from "src/rules/singleton_collector";
import { TypeScriptReexports } from "src/rules/type_script_reexports";
import type { RuleContextContract } from "src/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _source file semantic diagnostics_, _source responsibility verification_. **/
export class TypeScriptFileSemanticRules {
	private readonly _function_placement: FunctionPlacementRules;
	private readonly _responsibilities: ResponsibilityRules;
	private readonly _reexports: TypeScriptReexports;

	/** Responsibilities: _source module specifiers_. **/
	private append_module_specifier(imports: Set<string>, statement: ts.Statement): void {
		if (ts.isImportDeclaration(statement)) {
			if (ts.isStringLiteral(statement.moduleSpecifier)) {
				imports.add(statement.moduleSpecifier.text);
			}
			return;
		}
		if (!ts.isImportEqualsDeclaration(statement)) {
			return;
		}
		if (!ts.isExternalModuleReference(statement.moduleReference)) {
			return;
		}
		if (ts.isStringLiteral(statement.moduleReference.expression)) {
			imports.add(statement.moduleReference.expression.text);
		}
	}

	/** Responsibilities: _module import analysis_, _re-export analysis_. **/
	private source_import_violations(file: string, source_file: ts.SourceFile): ViolationContract[] {
		const violations: ViolationContract[] = [];
		const imports = new Set<string>();
		for (const statement of source_file.statements) {
			this.append_module_specifier(imports, statement);
		}
		if (imports.size > MAX_IMPORT_FAN_OUT) {
			const rule = new DiagnosticRule("import-fan-out");
			violations.push(rule.violation(file, 1));
		}
		this._reexports.append(violations, file, source_file);
		return violations;
	}

	/** Responsibilities: _free function violation collection_. **/
	private function_placement_violations(
		placement: ModulePlacementContext,
		normalized_ast: NormalizedAstFile,
	): ViolationContract[] {
		const { file, violations, functions, entry_point } = placement;
		const file_name = new LintFileName(file);
		if (file_name.functions_file() && !file_name.test()) {
			const rule = new DiagnosticRule(FUNCTIONS_FILE_TYPE_DECLARATION_RULE);
			for (const declaration of normalized_ast.references.type_declarations) {
				violations.push(rule.violation(file, declaration.line + 1));
			}
		}
		this._function_placement.append(violations, file, functions, entry_point);
		return violations;
	}

	/** Responsibilities: _entry point resolution_. **/
	private entry_point(context: RuleContextContract, file: string, source_file: ts.SourceFile): boolean {
		const scope = context.state().project.rule_scope;
		if (!scope.project_scope()) {
			return source_file.getFullText().startsWith(NODE_EXECUTABLE_SHEBANG);
		}
		const analysis = scope.project_analysis();
		return analysis.scanner().entry_point_files().has(resolve(analysis.root(), file));
	}

	/** Responsibilities: _semantic rule initialization_. **/
	public constructor() {
		this._function_placement = new FunctionPlacementRules(FUNCTION_MODULE_NAMES);
		this._responsibilities = new ResponsibilityRules(
			new ResponsibilityWording(
				new Set([...RESPONSIBILITY_ACTION_WORDS, ...RESPONSIBILITY_ACTION_EXTENSIONS]),
				RESPONSIBILITY_CONDITION_WORDS,
				RESPONSIBILITY_NOUN_WORDS,
			),
		);
		this._reexports = new TypeScriptReexports(new DiagnosticRule("reexports"));
	}

	/** Responsibilities: _source semantic diagnostic publication_. **/
	public append(request: TypeScriptNodeVerificationRequest): void {
		const {
			source: { file, normalized_ast, source_file },
		} = request.context.state();
		const class_names = new Set(normalized_ast.source.classes.map((node) => node.identity.name));
		const collector = new SingletonCollector(file, class_names, normalized_ast, source_file);
		const violations = this.source_import_violations(file, source_file);
		const entry_point = this.entry_point(request.context, file, source_file);
		const placement: ModulePlacementContext = {
			violations: [],
			file,
			functions: normalized_ast.source.functions,
			entry_point,
		};
		violations.push(...this.function_placement_violations(placement, normalized_ast));
		violations.push(...collector.collect_violations(false));
		for (const violation of violations) {
			request.context.append_violation(violation);
		}
	}

	/** Responsibilities: _source responsibility diagnostic publication_. **/
	public append_responsibilities(request: TypeScriptNodeVerificationRequest): void {
		const {
			source: { file, normalized_ast },
		} = request.context.state();
		const violations = this._responsibilities.collect(file, normalized_ast.module_declarations.responsibility_targets);
		for (const violation of violations) {
			request.context.append_violation(violation);
		}
	}
}
