import { basename } from "node:path";
import type { NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ViolationContract } from "src/reporting_protocols";
import { MODULE_PROTOCOL_NAME, MODULE_TYPE_NAME } from "src/rules/constants";
import { ModuleDeclarationFileAnalysis } from "src/rules/support/module_declaration_file_analysis";
import type { ModuleDeclarationPolicyData } from "src/rules/support/protocols";
import type { ModuleDeclarationsRuleContract } from "src/shared_services_protocols";

/** Responsibilities: _module content classification_, _declaration placement diagnostics_. **/
export class ModuleDeclarationsRule implements ModuleDeclarationsRuleContract {
	private readonly _policy: ModuleDeclarationPolicyData;
	private readonly _special_files: ReadonlySet<string>;

	/** Responsibilities: _focused declaration module classification_. **/
	private focused_module(name: string, declarations: ReadonlySet<string>, kind: string): boolean {
		if (declarations.has(name)) {
			return true;
		}
		const pattern = new RegExp(`(?:^|[_-])${kind}\\.(?:ts|py)$`, "u");
		return pattern.test(name);
	}

	/** Responsibilities: _module declaration rule initialization_. **/
	public constructor(
		special_files: ReadonlySet<string>,
		constants_files: ReadonlySet<string>,
		type_files: ReadonlySet<string>,
		protocol_files: ReadonlySet<string>,
	) {
		this._policy = {
			constants_files: constants_files,
			type_files: type_files,
			protocol_files: protocol_files,
			constants_rule: new DiagnosticRule("module-constants-separation"),
			types_rule: new DiagnosticRule("module-types-separation"),
			protocols_rule: new DiagnosticRule("module-protocols-separation"),
			content_rule: new DiagnosticRule("constants-file-content"),
		};
		this._special_files = special_files;
	}

	/** Responsibilities: _module declaration placement analysis_. **/
	public append(violations: ViolationContract[], file: string, ast: NormalizedAstFile): void {
		const analysis = new ModuleDeclarationFileAnalysis(this._policy, violations, file, ast);
		if (this._policy.constants_files.has(basename(file))) {
			analysis.append_forbidden_content();
			return;
		}
		const file_name = basename(file);
		if (this.focused_module(file_name, this._policy.type_files, MODULE_TYPE_NAME)) {
			return;
		}
		if (this.focused_module(file_name, this._policy.protocol_files, MODULE_PROTOCOL_NAME)) {
			return;
		}
		analysis.append_declarations();
	}

	/** Responsibilities: _special declaration module classification_. **/
	public declaration_module(file: string): boolean {
		const name = basename(file);
		if (this._special_files.has(name)) {
			return true;
		}
		if (this.focused_module(name, this._policy.type_files, MODULE_TYPE_NAME)) {
			return true;
		}
		return this.focused_module(name, this._policy.protocol_files, MODULE_PROTOCOL_NAME);
	}
}
