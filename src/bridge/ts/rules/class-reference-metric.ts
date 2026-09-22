import { TestPathSyntax } from 'src/test-path-syntax';
import type { Violation } from 'src/protocols';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { AstClassNode, LintSourceRecord } from 'src/types';
import type { ClassDefinition, ParsedClassFile } from 'src/bridge/ts/rules/types';
import { CLASS_REFERENCE_INFO, CLASS_REFERENCE_WARNING } from 'src/bridge/ts/rules/constants';

/** Responsibilities: _indexing class references reporting_. **/
export class ClassReferenceMetric {
	private readonly test_path_syntax = new TestPathSyntax();
	private readonly reference_info = CLASS_REFERENCE_INFO;
	private readonly reference_warning = CLASS_REFERENCE_WARNING;

	/** Responsibilities: _creation class-reference metric violation_. **/
	private violation(definition: ClassDefinition, count: number): Violation {
		const rule_id =
			count >= this.reference_warning ? 'class-reference-warning' : 'class-reference-info';
		const rule = new DiagnosticRule(rule_id);
		return rule.violation(definition.file, definition.node.start + 1, {
			name: definition.node.name,
			count: String(count),
		});
	}

	/** Responsibilities: _collection referencing files each_. **/
	private collect_references(parsed: ParsedClassFile[]): Map<string, Set<string>> {
		const references_by_class = new Map<string, Set<string>>();
		for (const file of parsed)
			for (const node of file.ast.classes)
				for (const name of new Set(this.class_names(node))) {
					let referenced_files = references_by_class.get(name);
					if (referenced_files === undefined) {
						referenced_files = new Set<string>();
					}
					referenced_files.add(file.file);
					references_by_class.set(name, referenced_files);
				}
		return references_by_class;
	}

	/** Responsibilities: _creation violation class exceeds_. **/
	private reference_violation(
		definition: ClassDefinition,
		references_by_class: Map<string, Set<string>>
	): Violation[] {
		let references = references_by_class.get(definition.node.name);
		if (references === undefined) {
			references = new Set();
		}
		const count = [...references].filter(
			file => file !== definition.file
		).length;
		if (count >= this.reference_info) {
			return [this.violation(definition, count)];
		}
		return [];
	}

	/** Responsibilities: _output names which class_. **/
	public class_names(node: AstClassNode): string[] {
		let class_fields = node.fields;
		if (class_fields === undefined) {
			class_fields = [];
		}
		const fields = class_fields
			.map(field => field.type)
			.filter(type => type !== undefined);
		const initializer = node.methods.find(
			method => method.name === 'constructor' || method.name === '__init__'
		);
		let arguments_: string[] = [];
if (initializer !== undefined && initializer.typed_arguments !== undefined) {
			arguments_ = initializer.typed_arguments
				.map(argument => argument.type)
				.filter(type => type !== undefined);
		}
		return [...fields, ...arguments_].map(type => type.split('<', 1)[0].trim());
	}

	/** Responsibilities: _collection class-reference violations source_. **/
	public collect_class_refs(sources: readonly LintSourceRecord[]): Violation[] {
		const parsed = sources
			.filter(source => !this.test_path_syntax.test_file(source.relative_path))
			.map(source => ({
				file: source.relative_path,
				ast: source.normalized_ast,
			}));
		const references_by_class = this.collect_references(parsed);
		const violations: Violation[] = [];
		for (const file of parsed) {
			for (const node of file.ast.classes) {
				if (node.type_contract || node.protocol) {
					continue;
				}
				violations.push(
					...this.reference_violation({ file: file.file, node }, references_by_class)
				);
			}
		}
		return violations;
	}
}
