import { TEST_PATH_SUFFIXES } from "src/constants";
import type { ViolationContract } from "src/reporting_protocols";
import {
	MODULE_CONSTANT_FILES,
	MODULE_DECLARATION_FILES,
	MODULE_PROTOCOL_FILES,
	MODULE_TYPE_FILES,
} from "src/rules/constants";
import { FileNameRules } from "src/rules/support/file_name_rules";
import { ModuleDeclarationsRule } from "src/rules/support/module_declarations_rule";
import { TestPathSyntax } from "src/test_path_syntax";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";

/** Responsibilities: _class file naming_, _module declaration placement_. **/
export class TypeScriptFileDeclarationRules {
	private readonly _file_names: FileNameRules;
	private readonly _module_declarations: ModuleDeclarationsRule;

	/** Responsibilities: _declaration rule initialization_. **/
	public constructor() {
		this._file_names = new FileNameRules(new TestPathSyntax(TEST_PATH_SUFFIXES));
		this._module_declarations = new ModuleDeclarationsRule(
			MODULE_DECLARATION_FILES,
			MODULE_CONSTANT_FILES,
			MODULE_TYPE_FILES,
			MODULE_PROTOCOL_FILES,
		);
	}

	/** Responsibilities: _class file naming diagnostics_. **/
	public append_class_filename(request: TypeScriptNodeVerificationRequest): void {
		const {
			source: { file, normalized_ast },
		} = request.context.state();
		const violations: ViolationContract[] = [];
		this._file_names.append_numeric(violations, file);
		this._file_names.append(violations, file, normalized_ast.source.classes);
		for (const violation of violations) {
			request.context.append_violation(violation);
		}
	}

	/** Responsibilities: _module declaration placement diagnostics_. **/
	public append_module_declarations(request: TypeScriptNodeVerificationRequest): void {
		const {
			source: { file, normalized_ast },
		} = request.context.state();
		const violations: ViolationContract[] = [];
		this._module_declarations.append(violations, file, normalized_ast);
		for (const violation of violations) {
			request.context.append_violation(violation);
		}
	}
}
