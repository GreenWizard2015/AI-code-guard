import { TEST_PATH_SUFFIXES } from "src/constants";
import type { ViolationContract } from "src/reporting_protocols";
import {
	MODULE_CONSTANT_FILES,
	MODULE_DECLARATION_FILES,
	MODULE_PROTOCOL_FILES,
	MODULE_TYPE_FILES,
} from "src/rules/constants";
import { ModuleDeclarationsRule } from "src/rules/support/module_declarations_rule";
import { SingleClassFileNameRule } from "src/rules/support/single_class_file_name_rule";
import { TestPathSyntax } from "src/test_path_syntax";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";

/** Responsibilities: _class file naming_, _module declaration placement_. **/
export class TypeScriptFileDeclarationRules {
	private readonly _class_file_name: SingleClassFileNameRule;
	private readonly _module_declarations: ModuleDeclarationsRule;

	/** Responsibilities: _declaration rule initialization_. **/
	public constructor() {
		this._class_file_name = new SingleClassFileNameRule(new TestPathSyntax(TEST_PATH_SUFFIXES));
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
		this._class_file_name.append(violations, file, normalized_ast.source.classes);
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
