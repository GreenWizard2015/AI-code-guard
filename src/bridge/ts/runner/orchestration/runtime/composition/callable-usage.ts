import { TestPathSyntax } from 'src/test-path-syntax';
import type { CallableClassIndex, CallableDefinition, CallableProjectIndex, ParsedFile } from 'src/metrics/types';
import type { Violation } from 'src/protocols';
import type { LintSourceRecord } from 'src/types';
import type { AstClassNode } from 'src/types';
import { PROPERTY_DECORATORS } from 'src/bridge/ts/runner/orchestration/runtime/composition/constants';
import type { CallableIndexes, CallableUsageCollectorState } from 'src/bridge/ts/runner/orchestration/runtime/composition/types';
import { LintStageTimer } from 'src/bridge/ts/core/stage-timing';
import { CallableMethodCounts } from 'src/bridge/ts/runner/orchestration/runtime/callable-method-counts';
import { CallableViolationCollector } from 'src/bridge/ts/runner/orchestration/runtime/composition/callable-violation-collector';
import { CallableReferenceIndex } from 'src/metrics/callable-reference-index';

/** Responsibilities: _collection callable usage construction_. **/
export class CallableUsage {
	private readonly property_decorators = PROPERTY_DECORATORS;

	/** Responsibilities: _mark externally inherited classes_. **/
	private mark_external_bases(parsed_files: ParsedFile[]): void {
		const class_names = new Set(
			parsed_files.flatMap(file => file.ast.classes.map(class_node => class_node.name))
		);
		for (const file of parsed_files) {
			for (const class_node of file.ast.classes) {
				class_node.extends_external_class = this.base_names_for(class_node).some(
					base => !class_names.has(base)
				);
			}
		}
	}

	/** Responsibilities: _source types project addition_. **/
	private add_type_indexes(file: ParsedFile, project_types: CallableProjectIndex): void {
		const type_members = file.ast.type_members;
		if (type_members !== undefined) {
			for (const [name, members] of Object.entries(type_members)) {
				if (!project_types.has(name)) {
					project_types.set(name, members);
				}
			}
		}
		for (const class_node of file.ast.classes) {
				this.class_type_index(class_node, project_types);
		}
	}

	/** Responsibilities: _index class type_. **/
	private class_type_index(class_node: AstClassNode, project_types: CallableProjectIndex): void {
		let fields = class_node.fields;
		if (fields === undefined) {
			fields = [];
		}
		const field_map: Record<string, string> = {};
		for (const field of fields) {
			if (field.type !== undefined) {
				field_map[field.name] = field.type;
			}
		}
if (Object.keys(field_map).length > 0 && !project_types.has(class_node.name)) {
			project_types.set(class_node.name, field_map);
		}
	}

	/** Responsibilities: _callable analysis indexes construction_. **/
	private build_indexes(
		parsed_files: ParsedFile[],
		production_files: ParsedFile[]
	): CallableIndexes {
		const project_types: CallableProjectIndex = new Map();
		const class_nodes: CallableClassIndex = new Map();
		for (const file of parsed_files) {
			this.add_type_indexes(file, project_types);
			for (const class_node of file.ast.classes) {
				if (!class_nodes.has(class_node.name)) {
					class_nodes.set(class_node.name, class_node);
				}
			}
		}
		const reference_index = new CallableReferenceIndex();
		reference_index.index_files(production_files);
		return {
			project_types,
			class_nodes,
			reference_index,
		};
	}

	/** Responsibilities: _collection callable definitions file_. **/
	private callable_definitions(file: ParsedFile): CallableDefinition[] {
		const functions = file.ast.functions.map(node => ({
			file: file.file,
			kind: 'function' as const,
			node,
		}));
		const methods = file.ast.classes
			.filter(class_node => !class_node.type_contract && !class_node.protocol)
			.flatMap(class_node =>
				class_node.methods.map(node => ({
					file: file.file,
					kind: 'method' as const,
					node,
				}))
			);
		return [...functions, ...methods];
	}

	/** Responsibilities: _identification analyzable callable method_. **/
	private is_callable_method(item: CallableDefinition): boolean {
if (item.file.startsWith('tools/coding-lint/') || item.node.visibility === 'private') {
			return false;
		}
		if (item.node.is_accessor || item.node.name === 'constructor') {
			return false;
		}
if (item.node.name.startsWith('__') && item.node.name.endsWith('__')) {
			return false;
		}
		const decorators = item.node.decorators;
		if (decorators === undefined) {
			return true;
		}
		return !decorators.some(name => this.property_decorators.has(name));
	}

	/** Responsibilities: _identification analyzable callable definition_. **/
	private is_callable_definition(item: CallableDefinition): boolean {
		if (item.kind === 'function') {
		if (item.file.startsWith('tools/coding-lint/')) {
			return false;
		}
		if (item.node.visibility === 'private') {
			return false;
		}
		return !item.node.is_accessor;
		}
		return this.is_callable_method(item);
	}

	/** Responsibilities: _source record preparation_. **/
	private parsed_sources(
		sources: readonly LintSourceRecord[],
		stage_timer: LintStageTimer
	): ParsedFile[] {
		return stage_timer.measure(
			'global-analysis.callable-usage.parsed-files',
			() => sources.map(source => ({
				file: source.relative_path,
				ast: source.normalized_ast,
			}))
		);
	}

	/** Responsibilities: _production source records selection_. **/
	private production_sources(
		parsed_files: ParsedFile[],
		stage_timer: LintStageTimer
	): ParsedFile[] {
		const test_path_syntax = new TestPathSyntax();
		return stage_timer.measure(
			'global-analysis.callable-usage.production-files',
			() => parsed_files.filter(file => !test_path_syntax.test_file(file.file))
		);
	}

	/** Responsibilities: _production callable definitions collection_. **/
	private callable_definitions_for(
		production_files: ParsedFile[],
		stage_timer: LintStageTimer
	): CallableDefinition[] {
		return stage_timer.measure(
			'global-analysis.callable-usage.definitions',
			() => production_files
				.flatMap(file => this.callable_definitions(file))
				.filter(definition => this.is_callable_definition(definition))
		);
	}

	/** Responsibilities: _callable method count_. **/
	private method_counts_for(definitions: readonly CallableDefinition[]): CallableMethodCounts {
		const method_counts = new CallableMethodCounts();
		for (const definition of definitions) {
			method_counts.append(definition);
		}
		return method_counts;
	}

	/** Responsibilities: _construction callable usage collector_. **/
	private collector_state(
		sources: readonly LintSourceRecord[],
		stage_timer: LintStageTimer
	): CallableUsageCollectorState {
		const parsed_files = this.parsed_sources(sources, stage_timer);
		stage_timer.measure(
			'global-analysis.callable-usage.external-bases',
			() => this.mark_external_bases(parsed_files)
		);
		const production_files = this.production_sources(parsed_files, stage_timer);
		const indexes = stage_timer.measure(
			'global-analysis.callable-usage.indexes',
			() => this.build_indexes(parsed_files, production_files)
		);
		const definitions = this.callable_definitions_for(production_files, stage_timer);
		return {
			parsed_files,
			production_files,
			definitions,
			method_counts: this.method_counts_for(definitions),
			project_types: indexes.project_types,
			class_nodes: indexes.class_nodes,
			reference_index: indexes.reference_index,
		};
	}

	/** Responsibilities: _collection timed callable usage_. **/
	public collect_timed_usage(
		sources: readonly LintSourceRecord[],
		stage_timer: LintStageTimer
	): Violation[] {
		const state = stage_timer.measure(
			'global-analysis.callable-usage.state',
			() => this.collector_state(sources, stage_timer)
		);
		const collector = new CallableViolationCollector(state);
		return stage_timer.measure(
			'global-analysis.callable-usage.violation-collection',
			() => collector.collect_all()
		);
	}

	/** Responsibilities: _class base names exposure_. **/
	public base_names_for(class_node: AstClassNode): string[] {
		if (class_node.base_class_names.length > 0) {
			return class_node.base_class_names;
		}
		if (class_node.base_class_name.length > 0) {
			return [class_node.base_class_name];
		}
		return [];
	}

}
