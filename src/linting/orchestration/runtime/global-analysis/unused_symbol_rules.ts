import { DiagnosticRule } from "src/model/diagnostic_rule";
import { TestPathSyntax } from "src/test_path_syntax";
import type { ProjectSourceScannerContract } from "src/source_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintSourceRecord } from "src/source_types";
import { UNUSED_SYMBOL_KIND } from "src/core/types";
import type { UnusedSymbolKind } from "src/core/types";
import type { UnusedSymbolDefinition } from "src/core/types";
import type { UnusedSymbolDefinitionCollection } from "src/core/types";
import { PUBLIC_FIELD_KIND } from "src/constants";
import { UnusedSymbolReferenceIndex } from "src/linting/orchestration/runtime/global-analysis/unused_symbol_reference_index";
import type {
	UnusedSymbolDefinitionCollectorContract,
	UnusedSymbolReferenceIndexContract,
} from "src/linting/orchestration/runtime/global-analysis/protocols";
import { UnusedSymbolDefinitionCollector } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/unused_symbol_definition_collector";

/** Responsibilities: _unused project symbol indexing_, _unused declaration reporting_. **/
export class UnusedSymbolRules {
	private readonly test_path_syntax: TestPathSyntax;
	private readonly rules: ReadonlyMap<UnusedSymbolKind, DiagnosticRule>;
	private readonly definition_collector: UnusedSymbolDefinitionCollectorContract;
	private readonly test_only_rule: DiagnosticRule;

	/** Responsibilities: _production symbol eligibility_. **/
	private production(source: LintSourceRecord, scanner: ProjectSourceScannerContract): boolean {
		if (!source.file_name.product()) {
			return false;
		}
		if (this.test_path_syntax.test_file(source.relative_path)) {
			return false;
		}
		return !scanner.entry(source.absolute_path);
	}

	/** Responsibilities: _production source eligibility_. **/
	private production_source(source: LintSourceRecord): boolean {
		if (!source.file_name.product()) {
			return false;
		}
		return !this.test_path_syntax.test_file(source.relative_path);
	}

	/** Responsibilities: _unused symbol violation collection_. **/
	private violations(
		definitions: readonly UnusedSymbolDefinition[],
		index: UnusedSymbolReferenceIndexContract,
		test_index: UnusedSymbolReferenceIndexContract,
	): ViolationContract[] {
		const violations: ViolationContract[] = [];
		for (const definition of definitions) {
			this.append_definition_violations(violations, definition, index, test_index);
		}
		return violations;
	}

	/** Responsibilities: _single unused definition reporting_. **/
	private append_definition_violations(
		violations: ViolationContract[],
		definition: UnusedSymbolDefinition,
		index: UnusedSymbolReferenceIndexContract,
		test_index: UnusedSymbolReferenceIndexContract,
	): void {
		if (index.usage_present(definition)) {
			return;
		}
		const test_only = this.test_field_issue(definition, test_index);
		if (test_only.length > 0) {
			violations.push(...test_only);
			return;
		}
		const rule = this.rules.get(definition.kind);
		if (rule !== undefined) {
			violations.push(rule.violation(definition.file, definition.line, { name: definition.name }));
		}
	}

	/** Responsibilities: _test-only field reporting_. **/
	private test_field_issue(
		definition: UnusedSymbolDefinition,
		test_index: UnusedSymbolReferenceIndexContract,
	): ViolationContract[] {
		if (definition.kind !== PUBLIC_FIELD_KIND) {
			return [];
		}
		if (!test_index.usage_present(definition)) {
			return [];
		}
		return [
			this.test_only_rule.violation(definition.file, definition.line, {
				kind: PUBLIC_FIELD_KIND,
				label: `${definition.owner}.${definition.name}`,
			}),
		];
	}

	/** Responsibilities: _production symbol definition collection_. **/
	private production_definitions(
		sources: readonly LintSourceRecord[],
		scanner: ProjectSourceScannerContract,
	): UnusedSymbolDefinitionCollection {
		const all: UnusedSymbolDefinition[] = [];
		const by_file = new Map<string, UnusedSymbolDefinition[]>();
		for (const source of sources) {
			if (!this.production(source, scanner)) {
				continue;
			}
			const source_definitions = this.definitions(source, scanner);
			by_file.set(source.absolute_path, source_definitions);
			all.push(...source_definitions);
		}
		return { all, by_file };
	}

	/** Responsibilities: _production symbol usage indexing_. **/
	private index_production_sources(
		sources: readonly LintSourceRecord[],
		index: UnusedSymbolReferenceIndexContract,
	): void {
		for (const source of sources) {
			if (this.production_source(source)) {
				index.add_source(source);
			}
		}
	}

	/** Responsibilities: _test source usage indexing_. **/
	private index_test_sources(
		sources: readonly LintSourceRecord[],
		index: UnusedSymbolReferenceIndexContract,
	): void {
		for (const source of sources) {
			if (!this.test_path_syntax.test_file(source.relative_path)) {
				continue;
			}
			index.add_source(source);
		}
	}

	/** Responsibilities: _production usage index construction_. **/
	private production_index(
		sources: readonly LintSourceRecord[],
		scanner: ProjectSourceScannerContract,
		available_files: Set<string>,
		collected: UnusedSymbolDefinitionCollection,
	): UnusedSymbolReferenceIndexContract {
		const index = new UnusedSymbolReferenceIndex(scanner, available_files, collected.by_file);
		for (const definition of collected.all) {
			index.add_implementation(definition);
		}
		for (const [file, names] of scanner.external_symbol_usages()) {
			for (const name of names) {
				index.add_external_usage(file, name);
			}
		}
		this.index_production_sources(sources, index);
		return index;
	}

	/** Responsibilities: _test usage index construction_. **/
	private test_index(
		sources: readonly LintSourceRecord[],
		scanner: ProjectSourceScannerContract,
		available_files: Set<string>,
		collected: UnusedSymbolDefinitionCollection,
	): UnusedSymbolReferenceIndexContract {
		const index = new UnusedSymbolReferenceIndex(scanner, available_files, collected.by_file);
		for (const definition of collected.all) {
			index.add_implementation(definition);
		}
		this.index_test_sources(sources, index);
		return index;
	}

	/** Responsibilities: _unused symbol rule initialization_. **/
	public constructor() {
		this.test_path_syntax = new TestPathSyntax();
		this.rules = new Map<UnusedSymbolKind, DiagnosticRule>([
			[UNUSED_SYMBOL_KIND.Class, new DiagnosticRule("unused-class")],
			[UNUSED_SYMBOL_KIND.Constant, new DiagnosticRule("unused-constant")],
			[UNUSED_SYMBOL_KIND.Type, new DiagnosticRule("unused-type")],
			[UNUSED_SYMBOL_KIND.PublicField, new DiagnosticRule("unused-public-field")],
			[UNUSED_SYMBOL_KIND.ModuleVariable, new DiagnosticRule("unused-module-variable")],
		]);
		this.definition_collector = new UnusedSymbolDefinitionCollector();
		this.test_only_rule = new DiagnosticRule("test-only-usage");
	}

	/** Responsibilities: _source unused-symbol definition access_. **/
	public definitions(source: LintSourceRecord, scanner: ProjectSourceScannerContract): UnusedSymbolDefinition[] {
		if (!this.production(source, scanner)) {
			return [];
		}
		return this.definition_collector.definitions(source);
	}

	/** Responsibilities: _project-wide unused symbol reporting_. **/
	public collect(sources: readonly LintSourceRecord[], scanner: ProjectSourceScannerContract): ViolationContract[] {
		const available_files = new Set(sources.map((source) => source.absolute_path));
		const collected = this.production_definitions(sources, scanner);
		const index = this.production_index(sources, scanner, available_files, collected);
		const test_index = this.test_index(sources, scanner, available_files, collected);
		return this.violations(collected.all, index, test_index);
	}
}
