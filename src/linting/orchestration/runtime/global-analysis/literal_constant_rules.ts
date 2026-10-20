import { SourceReferenceIndex } from "src/core/source_reference_index";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { IMPLEMENTATION_RELATION } from "src/constants";
import type { LintProjectContextContract, SourceReferenceIndexContract } from "src/shared_services_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintSourceRecord } from "src/source_types";

/** Responsibilities: _project literal constant matching_, _reuse diagnostics_. **/
export class LiteralConstantRules {
	private readonly rule: DiagnosticRule;
	private readonly repeated_rule: DiagnosticRule;

	/** Responsibilities: _production source selection_. **/
	private production(source: LintSourceRecord): boolean {
		const file_name = source.file_name;
		if (!file_name.product()) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _language-separated literal key_. **/
	private key(source: LintSourceRecord, value: string): string {
		const language = source.language;
		const separator = "\u0000";
		return `${language}${separator}${value}`;
	}

	/** Responsibilities: _constant implementation registration_. **/
	private register_constants(
		sources: readonly LintSourceRecord[],
		index: SourceReferenceIndexContract<string>,
		constant_names: Map<string, string>,
	): void {
		for (const source of sources) {
			for (const constant of source.normalized_ast.literal_constants) {
				const key = this.key(source, constant.value);
				constant_names.set(key, constant.name);
				index.add_implementation(key, { file: source.file_name.value, line: constant.line + 1 });
			}
		}
	}

	/** Responsibilities: _literal usage registration_. **/
	private register_references(sources: readonly LintSourceRecord[], index: SourceReferenceIndexContract<string>): void {
		for (const source of sources) {
			for (const reference of source.normalized_ast.literal_references) {
				const key = this.key(source, reference.value);
				index.add_usage(key, { file: source.file_name.value, line: reference.line + 1 });
			}
		}
	}

	/** Responsibilities: _literal violation collection_. **/
	private collect_violations(
		sources: readonly LintSourceRecord[],
		index: SourceReferenceIndexContract<string>,
		constant_names: ReadonlyMap<string, string>,
	): ViolationContract[] {
		const violations: ViolationContract[] = [];
		for (const source of sources) {
			for (const reference of source.normalized_ast.literal_references) {
				const key = this.key(source, reference.value);
				const name = constant_names.get(key);
				const implementations = index.references_for(key, IMPLEMENTATION_RELATION);
				if (name === undefined) {
					this.append_repeated(violations, source, reference.line + 1, index.references_for(key, "usage").length);
					continue;
				}
				if (implementations.length > 0) {
					violations.push(this.rule.violation(source.file_name.value, reference.line + 1, { constant: name }));
				}
			}
		}
		return violations;
	}

	/** Responsibilities: _repeated literal diagnostic_. **/
	private append_repeated(
		violations: ViolationContract[],
		source: LintSourceRecord,
		line: number,
		usage_count: number,
	): void {
		if (usage_count < 2) {
			return;
		}
		violations.push(this.repeated_rule.violation(source.file_name.value, line, {}));
	}

	/** Responsibilities: _rule initialization_. **/
	public constructor() {
		this.rule = new DiagnosticRule("literal-constant-reuse");
		this.repeated_rule = new DiagnosticRule("repeated-literal");
	}

	/** Responsibilities: _production source collection_. **/
	public production_sources(context: LintProjectContextContract): LintSourceRecord[] {
		const sources: LintSourceRecord[] = [];
		for (const source of context.files()) {
			if (!this.production(source)) {
				continue;
			}
			sources.push(source);
		}
		return sources;
	}

	/** Responsibilities: _project literal constant diagnostics_. **/
	public violations(context: LintProjectContextContract): ViolationContract[] {
		const sources = this.production_sources(context);
		const index = new SourceReferenceIndex<string>();
		const constant_names = new Map<string, string>();
		this.register_constants(sources, index, constant_names);
		this.register_references(sources, index);
		return this.collect_violations(sources, index, constant_names);
	}
}
