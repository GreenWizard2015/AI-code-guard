import { basename, dirname, join } from "node:path";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ModuleDeclarationsRuleContract } from "src/shared_services_protocols";
import type { RuleContract, ViolationContract } from "src/reporting_protocols";
import type { AstSourceSpan, NormalizedAstFileContract } from "src/types";
import {
	MODULE_CONSTANT_FILES,
	MODULE_DECLARATION_FILES,
	MODULE_FUNCTION_KIND,
	MODULE_PROTOCOL_FILES,
	MODULE_PROTOCOL_NAME,
	MODULE_TYPE_FILES,
	MODULE_TYPE_NAME,
} from "src/rules/constants";

/** Responsibilities: _module content classification_, _declaration placement diagnostics_. **/
export class ModuleDeclarationsRule implements ModuleDeclarationsRuleContract {
	public readonly special_files: Set<string>;
	private readonly constants_files: Set<string>;
	private readonly constants_rule: RuleContract;
	private readonly types_rule: RuleContract;
	private readonly protocols_rule: RuleContract;
	private readonly content_rule: DiagnosticRule;

	/** Responsibilities: _focused declaration module classification_. **/
	private focused_module(name: string, declarations: ReadonlySet<string>, kind: string): boolean {
		if (declarations.has(name)) {
			return true;
		}
		const pattern = new RegExp(`(?:^|[_-])${kind}\\.(?:ts|py)$`, "u");
		return pattern.test(name);
	}

	/** Responsibilities: _aggregation constants-file violation misplaced_. **/
	private append_constants_violation(
		violations: ViolationContract[],
		file: string,
		spans: readonly AstSourceSpan[],
	): void {
		if (spans.length === 0) {
			return;
		}
		if (this.constants_files.has(basename(file))) {
			return;
		}
		const extension = file.endsWith(".py") ? "py" : "ts";
		violations.push(
			this.constants_rule.violation(file, spans[0].start_line + 1, {
				target: join(dirname(file), `constants.${extension}`),
			}),
		);
	}

	/** Responsibilities: _aggregation violation forbidden module_. **/
	private append_content_violation(violations: ViolationContract[], file: string, line: number, kind: string): void {
		const ext = file.endsWith(".py") ? "py" : "ts";
		const parameters = { kind, ext };
		const violation = this.content_rule.violation(file, line, parameters);
		violations.push(violation);
	}

	/** Responsibilities: _aggregation violation directing content_. **/
	private append_move_violation(violations: ViolationContract[], file: string, spans: readonly AstSourceSpan[]): void {
		if (spans.length === 0) {
			return;
		}
		if (this.focused_module(basename(file), MODULE_TYPE_FILES, MODULE_TYPE_NAME)) {
			return;
		}
		const extension = file.endsWith(".py") ? "py" : "ts";
		const target = join(dirname(file), `types.${extension}`);
		violations.push(
			this.types_rule.violation(file, spans[0].start_line + 1, {
				target,
			}),
		);
	}

	/** Responsibilities: _aggregation protocol placement violation_. **/
	private append_protocol_violation(
		violations: ViolationContract[],
		file: string,
		spans: readonly AstSourceSpan[],
	): void {
		if (spans.length === 0) {
			return;
		}
		if (this.focused_module(basename(file), MODULE_PROTOCOL_FILES, MODULE_PROTOCOL_NAME)) {
			return;
		}
		const extension = file.endsWith(".py") ? "py" : "ts";
		const target = join(dirname(file), `protocols.${extension}`);
		violations.push(
			this.protocols_rule.violation(file, spans[0].start_line + 1, {
				target,
			}),
		);
	}

	/** Responsibilities: _aggregation diagnostics content forbidden_. **/
	private append_forbidden_content(violations: ViolationContract[], file: string, ast: NormalizedAstFileContract): void {
		if (ast.functions.length > 0) {
			this.append_content_violation(violations, file, ast.functions[0].start + 1, MODULE_FUNCTION_KIND);
		}
		if (ast.classes.length > 0) {
			this.append_content_violation(violations, file, ast.classes[0].start + 1, "class");
		}
		if (ast.type_declarations.length > 0) {
			this.append_content_violation(violations, file, ast.type_declarations[0].line + 1, "type");
		}
	}

	/** Responsibilities: _aggregation module-separation moves normalization_. **/
	private append_module_moves(violations: ViolationContract[], file: string, ast: NormalizedAstFileContract): void {
		this.append_constants_violation(violations, file, ast.module_constant_spans);
		this.append_move_violation(violations, file, ast.module_type_spans);
		this.append_protocol_violation(violations, file, ast.module_protocol_spans);
	}

	/** Responsibilities: _aggregation module constants protocol_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.special_files = new Set(MODULE_DECLARATION_FILES);
		this.constants_files = new Set(MODULE_CONSTANT_FILES);
		this.constants_rule = new DiagnosticRule("module-constants-separation");
		this.types_rule = new DiagnosticRule("module-types-separation");
		this.protocols_rule = new DiagnosticRule("module-protocols-separation");
		this.content_rule = new DiagnosticRule("constants-file-content");
	}
	/** Responsibilities: _public operation_. **/
	public append(violations: ViolationContract[], file: string, ast: NormalizedAstFileContract): void {
		if (this.constants_files.has(basename(file))) {
			this.append_forbidden_content(violations, file, ast);
			return;
		}
		const file_name = basename(file);
		if (this.focused_module(file_name, MODULE_TYPE_FILES, MODULE_TYPE_NAME)) {
			return;
		}
		if (this.focused_module(file_name, MODULE_PROTOCOL_FILES, MODULE_PROTOCOL_NAME)) {
			return;
		}
		this.append_module_moves(violations, file, ast);
	}

	/** Responsibilities: _classification dedicated declaration module_. **/
	public declaration_module(file: string): boolean {
		const name = basename(file);
		if (this.special_files.has(name)) {
			return true;
		}
		const is_type_module = this.focused_module(name, MODULE_TYPE_FILES, MODULE_TYPE_NAME);
		if (is_type_module) {
			return true;
		}
		return this.focused_module(name, MODULE_PROTOCOL_FILES, MODULE_PROTOCOL_NAME);
	}
}
