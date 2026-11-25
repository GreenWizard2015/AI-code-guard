import { basename, dirname, join } from "node:path";
import type {
	AstSourceSpan,
	NormalizedAstFile,
	NormalizedAstModuleDeclarations,
	NormalizedAstSource,
	NormalizedAstSymbolReferences,
} from "src/model/ast/normalized_ast_types";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import {
	MODULE_FUNCTION_KIND,
	MODULE_PROTOCOL_NAME,
	PYTHON_DATA_MODELS_FILE_NAME,
	PYTHON_TYPES_FILE_NAME,
	MODULE_TYPES_SEPARATION_RULE_ID,
} from "src/rules/constants";
import type { ModuleDeclarationPolicyData } from "src/rules/support/protocols";

/** Responsibilities: _module declaration placement_, _forbidden declaration content_, _target path creation_. **/
export class ModuleDeclarationFileAnalysis {
	private readonly _policy: ModuleDeclarationPolicyData;
	private readonly _violations: ViolationContract[];
	private readonly _file: string;
	private readonly _source: NormalizedAstSource;
	private readonly _references: NormalizedAstSymbolReferences;
	private readonly _module_declarations: NormalizedAstModuleDeclarations;

	/** Responsibilities: _declaration relocation violation_. **/
	private append_placement(
		spans: readonly AstSourceSpan[],
		declarations: ReadonlySet<string>,
		module_name: string,
		rule: RuleContract,
	): void {
		if (spans.length === 0 || declarations.has(basename(this._file))) {
			return;
		}
		const extension = this._file.endsWith(".py") ? "py" : "ts";
		const target = join(dirname(this._file), `${module_name}.${extension}`);
		const first_span = spans.at(0);
		if (first_span === undefined) {
			return;
		}
		this._violations.push(rule.violation(this._file, first_span.start_line + 1, { target }));
	}

	/** Responsibilities: _forbidden declaration content violation_. **/
	private append_content(line: number, kind: string): void {
		const extension = this._file.endsWith(".py") ? "py" : "ts";
		const parameters = { kind, ext: extension };
		this._violations.push(this._policy.content_rule.violation(this._file, line, parameters));
	}

	/** Responsibilities: _mixed dataclass declaration detection_. **/
	private data_class_mixed(): boolean {
		for (const item of this._source.classes) {
			if (!item.classification.is_data_class) {
				return true;
			}
		}
		for (const item of this._source.functions) {
			if (item.identity.owner.length === 0 && !item.identity.nested) {
				return true;
			}
		}
		for (const item of this._references.named_symbols) {
			if (item.is_module_variable && item.name !== "__all__") {
				return true;
			}
		}
		return this.has_other_declarations();
	}

	/** Responsibilities: _other declaration inventory_. **/
	private has_other_declarations(): boolean {
		const declarations = this._module_declarations;
		if (declarations.module_constant_spans.length > 0) {
			return true;
		}
		if (declarations.module_type_spans.length > 0) {
			return true;
		}
		return declarations.module_protocol_spans.length > 0;
	}

	/** Responsibilities: _module file analysis initialization_. **/
	public constructor(
		policy: ModuleDeclarationPolicyData,
		violations: ViolationContract[],
		file: string,
		ast: NormalizedAstFile,
	) {
		this._policy = policy;
		this._violations = violations;
		this._file = file;
		this._source = ast.source;
		this._references = ast.references;
		this._module_declarations = ast.module_declarations;
	}

	/** Responsibilities: _data class module isolation_. **/
	public append_data_classes(): void {
		const data_class = this._source.classes.find((item) => item.classification.is_data_class);
		if (data_class === undefined || !this.data_class_mixed()) {
			return;
		}
		const already_reported = this._violations.some(
			(item) => item.file() === this._file && item.rule_id() === MODULE_TYPES_SEPARATION_RULE_ID,
		);
		if (already_reported) {
			return;
		}
		let target_name = PYTHON_TYPES_FILE_NAME;
		if (basename(this._file) === PYTHON_TYPES_FILE_NAME) {
			target_name = PYTHON_DATA_MODELS_FILE_NAME;
		}
		const target = join(dirname(this._file), target_name);
		this._violations.push(
			this._policy.types_rule.violation(this._file, data_class.identity.start + 1, { target }),
		);
	}

	/** Responsibilities: _module declaration placement analysis_. **/
	public append_declarations(): void {
		this.append_placement(
			this._module_declarations.module_constant_spans,
			this._policy.constants_files,
			"constants",
			this._policy.constants_rule,
		);
		this.append_placement(
			this._module_declarations.module_type_spans,
			this._policy.type_files,
			"types",
			this._policy.types_rule,
		);
		this.append_placement(
			this._module_declarations.module_protocol_spans,
			this._policy.protocol_files,
			MODULE_PROTOCOL_NAME,
			this._policy.protocols_rule,
		);
	}

	/** Responsibilities: _constants module content analysis_. **/
	public append_forbidden_content(): void {
		for (const first_function of this._source.functions) {
			this.append_content(first_function.identity.start + 1, MODULE_FUNCTION_KIND);
			break;
		}
		for (const first_class of this._source.classes) {
			this.append_content(first_class.identity.start + 1, "class");
			break;
		}
		for (const first_type of this._references.type_declarations) {
			this.append_content(first_type.line + 1, "type");
			break;
		}
	}
}
