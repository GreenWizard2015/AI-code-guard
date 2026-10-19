import { SourceReferenceIndex } from "src/core/source_reference_index";
import type { SourceReferenceIndexContract, TestPathSyntaxContract, ViolationContract } from "src/protocols";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { AstClassNode, LintSourceRecord } from "src/types";
import type { ClassDefinition, ParsedClassFile } from "src/model/types/types";
import { CLASS_REFERENCE_INFO, CLASS_REFERENCE_WARNING } from "src/rules/constants";
import { CONSTRUCTOR_NAME, CONTRACT_SUFFIX, PYTHON_CONSTRUCTOR_NAME } from "src/metrics/constants";
import { RULE_IDS } from "src/constants";

/** Responsibilities: _class reference indexing_, _reference metric diagnostics_. **/
export class ClassReferenceMetric {
	private readonly test_path_syntax: TestPathSyntaxContract;
	private readonly reference_info = CLASS_REFERENCE_INFO;
	private readonly reference_warning = CLASS_REFERENCE_WARNING;

	/** Responsibilities: _creation class-reference metric violation_. **/
	private violation(definition: ClassDefinition, count: number): ViolationContract {
		let rule_id: string = RULE_IDS.class_reference_info;
		if (count >= this.reference_warning) {
			rule_id = RULE_IDS.class_reference_warning;
		}
		const rule = new DiagnosticRule(rule_id);
		return rule.violation(definition.file, definition.node.start + 1, {
			name: definition.node.name,
			count: String(count),
		});
	}

	/** Responsibilities: _class reference registration_. **/
	private append_class_references(
		references_by_class: SourceReferenceIndexContract<string>,
		file: ParsedClassFile,
		node: AstClassNode,
	): void {
		for (const name of new Set(this.class_names(node))) {
			references_by_class.add_usage(name, { file: file.file, line: node.start + 1 });
		}
	}

	/** Responsibilities: _collection referencing files each_. **/
	private collect_references(parsed: ParsedClassFile[]): SourceReferenceIndexContract<string> {
		const references_by_class = new SourceReferenceIndex<string>();
		for (const file of parsed) {
			for (const node of file.ast.classes) {
				references_by_class.add_implementation(node.name, { file: file.file, line: node.start + 1 });
				this.append_class_references(references_by_class, file, node);
			}
		}
		return references_by_class;
	}

	/** Responsibilities: _creation violation class exceeds_. **/
	private reference_violation(
		definition: ClassDefinition,
		references_by_class: SourceReferenceIndexContract<string>,
	): ViolationContract[] {
		const references = references_by_class.references_for(definition.node.name, "usage");
		const files = new Set(references.map((reference) => reference.file));
		files.delete(definition.file);
		const count = files.size;
		if (count >= this.reference_info) {
			return [this.violation(definition, count)];
		}
		return [];
	}

	/** Responsibilities: _class-reference metric dependencies_. **/
	public constructor(test_path_syntax: TestPathSyntaxContract) {
		this.test_path_syntax = test_path_syntax;
	}

	/** Responsibilities: _output names which class_. **/
	public class_names(node: AstClassNode): string[] {
		let class_fields = node.fields;
		if (class_fields === undefined) {
			class_fields = [];
		}
		const fields = class_fields.map((field) => field.type).filter((type) => type !== undefined);
		const initializer = node.methods.find(
			(method) => method.name === CONSTRUCTOR_NAME || method.name === PYTHON_CONSTRUCTOR_NAME,
		);
		let arguments_: string[] = [];
		if (initializer !== undefined && initializer.typed_arguments !== undefined) {
			arguments_ = initializer.typed_arguments.map((argument) => argument.type).filter((type) => type !== undefined);
		}
		const all_types = [...fields, ...arguments_];
		return all_types.map((type) => {
			const parts = type.split("<", 1);
			return parts[0].trim();
		});
	}

	/** Responsibilities: _collection class-reference violations source_. **/
	public collect_class_refs(sources: readonly LintSourceRecord[]): ViolationContract[] {
		const parsed = sources
			.filter((source) => !this.test_path_syntax.test_file(source.relative_path, false))
			.map((source) => ({
				file: source.relative_path,
				ast: source.normalized_ast,
			}));
		const references_by_class = this.collect_references(parsed);
		const violations: ViolationContract[] = [];
		for (const file of parsed) {
			for (const node of file.ast.classes) {
				if (node.type_contract || node.protocol || node.interfaces?.some((name) => name.endsWith(CONTRACT_SUFFIX))) {
					continue;
				}
				violations.push(...this.reference_violation({ file: file.file, node }, references_by_class));
			}
		}
		return violations;
	}
}
