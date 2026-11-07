import { PUBLIC_FIELD_KIND } from "src/constants";
import type { UnusedSymbolReferenceIndexContract } from "src/contracts/protocols/global_analysis_protocols";
import type { UnusedSymbolKind } from "src/core/types";
import type { UnusedSymbolDefinition } from "src/core/types";
import type { UnusedSymbolDefinitionCollection } from "src/core/types";
import { UnusedSymbolDefinitionCollector } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/unused_symbol_definition_collector";
import { UnusedSymbolReferenceIndex } from "src/linting/orchestration/runtime/global-analysis/unused_symbol_reference_index";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { TestPathSyntaxContract } from "src/shared_services_protocols";
import type { ProjectSourceScanContract } from "src/source_protocols";
import type { LintSourceRecordData } from "src/source_types";
import { TestPathKind } from "src/types";

/** Responsibilities: _unused project symbol indexing_, _unused declaration reporting_. **/
export class UnusedSymbolRules {
	private readonly _test_path_syntax: TestPathSyntaxContract;
	private readonly _rules: ReadonlyMap<UnusedSymbolKind, RuleContract>;
	private readonly _test_only_rule: RuleContract;
	private readonly _sources: readonly LintSourceRecordData[];
	private readonly _scanner: ProjectSourceScanContract;
	private readonly _available_files: Set<string>;

	/** Responsibilities: _production symbol eligibility_. **/
	private production(source: LintSourceRecordData): boolean {
		if (!source.file_name.product()) {
			return false;
		}
		if (this._test_path_syntax.classify(source.relative_path).has(TestPathKind.TestFile)) {
			return false;
		}
		return !this._scanner.project_source_entry().entry(source.absolute_path);
	}

	/** Responsibilities: _unused symbol violation collection_. **/
	private violations(
		definitions: readonly UnusedSymbolDefinition[],
		production_index: UnusedSymbolReferenceIndexContract,
		test_reference_index: UnusedSymbolReferenceIndexContract,
	): ViolationContract[] {
		const violations: ViolationContract[] = [];
		for (const definition of definitions) {
			this.append_definition_violations(violations, definition, production_index, test_reference_index);
		}
		return violations;
	}

	/** Responsibilities: _single unused definition reporting_. **/
	private append_definition_violations(
		violations: ViolationContract[],
		definition: UnusedSymbolDefinition,
		production_index: UnusedSymbolReferenceIndexContract,
		test_reference_index: UnusedSymbolReferenceIndexContract,
	): void {
		if (production_index.usage_present(definition)) {
			return;
		}
		if (definition.kind === PUBLIC_FIELD_KIND) {
			if (test_reference_index.usage_present(definition)) {
				violations.push(
					this._test_only_rule.violation(definition.file, definition.line, {
						kind: PUBLIC_FIELD_KIND,
						label: `${definition.owner}.${definition.name}`,
					}),
				);
				return;
			}
		}
		const rule = this._rules.get(definition.kind);
		if (rule !== undefined) {
			violations.push(rule.violation(definition.file, definition.line, { name: definition.name }));
		}
	}

	/** Responsibilities: _production symbol definition collection_. **/
	private production_definitions(): UnusedSymbolDefinitionCollection {
		const all: UnusedSymbolDefinition[] = [];
		const by_file = new Map<string, UnusedSymbolDefinition[]>();
		for (const source of this._sources) {
			if (!this.production(source)) {
				continue;
			}
			const source_definitions = this.definitions(source);
			by_file.set(source.absolute_path, source_definitions);
			all.push(...source_definitions);
		}
		return { all, by_file };
	}

	/** Responsibilities: _production source usage indexing_. **/
	private index_production_sources(index: UnusedSymbolReferenceIndexContract): void {
		for (const source of this._sources) {
			if (!source.file_name.product()) {
				continue;
			}
			if (this._test_path_syntax.classify(source.relative_path).has(TestPathKind.TestFile)) {
				continue;
			}
			index.add_source(source);
		}
	}

	/** Responsibilities: _production usage index construction_. **/
	private production_index(collected: UnusedSymbolDefinitionCollection): UnusedSymbolReferenceIndexContract {
		const production_index = new UnusedSymbolReferenceIndex(this._scanner, this._available_files, collected.by_file);
		for (const definition of collected.all) {
			production_index.add_implementation(definition);
		}
		for (const [file, names] of this._scanner.external_symbol_usages()) {
			for (const name of names) {
				production_index.add_external_usage(file, name);
			}
		}
		this.index_production_sources(production_index);
		return production_index;
	}

	/** Responsibilities: _test usage index construction_. **/
	private test_index(collected: UnusedSymbolDefinitionCollection): UnusedSymbolReferenceIndexContract {
		const test_reference_index = new UnusedSymbolReferenceIndex(
			this._scanner,
			this._available_files,
			collected.by_file,
		);
		for (const definition of collected.all) {
			test_reference_index.add_implementation(definition);
		}
		for (const source of this._sources) {
			if (!this._test_path_syntax.classify(source.relative_path).has(TestPathKind.TestFile)) {
				continue;
			}
			test_reference_index.add_source(source);
		}
		return test_reference_index;
	}

	/** Responsibilities: _unused symbol policy dependencies_. **/
	public constructor(
		test_path_syntax: TestPathSyntaxContract,
		rules: ReadonlyMap<UnusedSymbolKind, RuleContract>,
		test_only_rule: RuleContract,
		sources: readonly LintSourceRecordData[],
		scanner: ProjectSourceScanContract,
	) {
		this._test_path_syntax = test_path_syntax;
		this._rules = rules;
		this._test_only_rule = test_only_rule;
		this._sources = sources;
		this._scanner = scanner;
		this._available_files = new Set(sources.map((source) => source.absolute_path));
	}

	/** Responsibilities: _source unused-symbol definition access_. **/
	public definitions(source: LintSourceRecordData): UnusedSymbolDefinition[] {
		if (!this.production(source)) {
			return [];
		}
		const collector = new UnusedSymbolDefinitionCollector(source);
		return collector.definitions();
	}

	/** Responsibilities: _project-wide unused symbol reporting_. **/
	public collect(): ViolationContract[] {
		const collected = this.production_definitions();
		const production_index = this.production_index(collected);
		const test_reference_index = this.test_index(collected);
		return this.violations(collected.all, production_index, test_reference_index);
	}
}
