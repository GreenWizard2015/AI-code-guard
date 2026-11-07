import { SourceReferenceIndex } from "src/core/source_reference_index";
import type { SourceReferenceIndexContract, TestPathSyntaxContract } from "src/shared_services_protocols";
import { TestPathKind } from "src/types";

import { RULE_IDS } from "src/linting/constants";
import { CONSTRUCTOR_NAME, PYTHON_CONSTRUCTOR_NAME } from "src/metrics/constants";
import type { AstClassNode } from "src/model/ast/normalized_ast_types";
import type { AstLanguage } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ClassDefinition, ParsedClassFile } from "src/model_types";
import type { ViolationContract } from "src/reporting_protocols";
import { CLASS_REFERENCE_INFO, CLASS_REFERENCE_WARNING } from "src/rules/constants";
import type { LintSourceRecordData } from "src/source_types";

/** Responsibilities: _class reference indexing_, _reference metric diagnostics_. **/
export class ClassReferenceMetric {
	private readonly _test_path_syntax: TestPathSyntaxContract;
	private readonly _reference_info: number;
	private readonly _reference_warning: number;

	/** Responsibilities: _creation class-reference metric violation_. **/
	private violation(definition: ClassDefinition, count: number): ViolationContract {
		let rule_id: string = RULE_IDS.class_reference_info;
		if (count >= this._reference_warning) {
			rule_id = RULE_IDS.class_reference_warning;
		}
		const rule = new DiagnosticRule(rule_id);
		return rule.violation(definition.file, definition.node.identity.start + 1, {
			name: definition.node.identity.name,
			count: String(count),
		});
	}

	/** Responsibilities: _class reference registration_. **/
	private append_class_references(
		references_by_class: SourceReferenceIndexContract<string>,
		target: ClassDefinition,
	): void {
		for (const name of new Set(this.class_names(target.node))) {
			references_by_class.add_usage(name, { file: target.file, line: target.node.identity.start + 1 });
		}
	}

	/** Responsibilities: _collection referencing files each_. **/
	private collect_references(parsed: ParsedClassFile[]): SourceReferenceIndexContract<string> {
		const references_by_class = new SourceReferenceIndex<string>();
		for (const file of parsed) {
			for (const node of file.ast.source.classes) {
				references_by_class.add_implementation(node.identity.name, { file: file.file, line: node.identity.start + 1 });
				this.append_class_references(references_by_class, { file: file.file, node });
			}
		}
		return references_by_class;
	}

	/** Responsibilities: _creation violation class exceeds_. **/
	private reference_violation(
		definition: ClassDefinition,
		references_by_class: SourceReferenceIndexContract<string>,
	): ViolationContract[] {
		const references = references_by_class.references_for(definition.node.identity.name, "usage");
		const files = new Set(references.map((reference) => reference.file));
		files.delete(definition.file);
		const count = files.size;
		if (count >= this._reference_info) {
			return [this.violation(definition, count)];
		}
		return [];
	}

	/** Responsibilities: _class field type collection_. **/
	private field_types(class_node: AstClassNode): string[] {
		const types: string[] = [];
		const fields = class_node.field_analysis.fields;
		if (fields === undefined) {
			return types;
		}
		for (const field of fields) {
			if (field.type !== undefined) {
				types.push(field.type);
			}
		}
		return types;
	}

	/** Responsibilities: _constructor parameter type collection_. **/
	private parameter_types(class_node: AstClassNode): string[] {
		const types: string[] = [];
		const initializer = class_node.structure.methods.find(
			(method) => method.identity.name === CONSTRUCTOR_NAME || method.identity.name === PYTHON_CONSTRUCTOR_NAME,
		);
		if (initializer === undefined || initializer.signature.typed_arguments === undefined) {
			return types;
		}
		for (const argument of initializer.signature.typed_arguments) {
			if (argument.type !== undefined) {
				types.push(argument.type);
			}
		}
		return types;
	}

	/** Responsibilities: _class contract-shape classification_. **/
	private contract_class(node: AstClassNode): boolean {
		if (node.classification.type_contract) {
			return true;
		}
		if (node.classification.protocol) {
			return true;
		}
		return false;
	}

	/** Responsibilities: _class-reference metric dependencies_. **/
	public constructor(test_path_syntax: TestPathSyntaxContract) {
		this._test_path_syntax = test_path_syntax;
		this._reference_info = CLASS_REFERENCE_INFO;
		this._reference_warning = CLASS_REFERENCE_WARNING;
	}

	/** Responsibilities: _output names which class_. **/
	public class_names(node: AstClassNode): string[] {
		const types = this.field_types(node).concat(this.parameter_types(node));
		const names: string[] = [];
		for (const type of types) {
			const root_type = type.split("<", 1).at(0);
			if (root_type !== undefined) {
				names.push(root_type.trim());
			}
		}
		return names;
	}

	/** Responsibilities: _language-scoped class-reference collection_. **/
	public language_class_refs(sources: readonly LintSourceRecordData[], language: AstLanguage): ViolationContract[] {
		const parsed = sources
			.filter((source) => source.language === language)
			.filter((source) => !this._test_path_syntax.classify(source.relative_path).has(TestPathKind.TestFile))
			.map((source) => ({
				file: source.relative_path,
				ast: source.normalized_ast,
			}));
		const references_by_class = this.collect_references(parsed);
		const violations: ViolationContract[] = [];
		for (const file of parsed) {
			for (const node of file.ast.source.classes) {
				if (this.contract_class(node)) {
					continue;
				}
				violations.push(...this.reference_violation({ file: file.file, node }, references_by_class));
			}
		}
		return violations;
	}
}
