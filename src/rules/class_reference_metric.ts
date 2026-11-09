import { SourceReferenceIndex } from "src/core/source_reference_index";
import { ClassReferenceMetricEvaluation } from "src/rules/class_reference_metric_evaluation";
import type {
	LintStageTimerContract,
	SourceReferenceIndexContract,
	TestPathSyntaxContract,
} from "src/shared_services_protocols";
import { TestPathKind } from "src/types";

import { CONSTRUCTOR_NAME, PYTHON_CONSTRUCTOR_NAME } from "src/metrics/constants";
import type { AstClassNode } from "src/model/ast/normalized_ast_types";
import type { AstLanguage } from "src/model/ast/normalized_ast_types";
import type { ClassDefinition, ParsedClassFile } from "src/model_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintSourceRecordData } from "src/source_types";

/** Responsibilities: _class reference indexing_, _reference metric diagnostics_. **/
export class ClassReferenceMetric {
	private readonly _test_path_syntax: TestPathSyntaxContract;

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

	/** Responsibilities: _class reference violation collection_. **/
	private file_violations(
		file: ParsedClassFile,
		references_by_class: SourceReferenceIndexContract<string>,
		stage_timer: LintStageTimerContract,
	): ViolationContract[] {
		const violations: ViolationContract[] = [];
		for (const node of file.ast.source.classes) {
			if (!this.contract_class(node)) {
				const evaluation = new ClassReferenceMetricEvaluation(
					{ file: file.file, node },
					references_by_class,
					stage_timer,
				);
				violations.push(...evaluation.violations());
			}
		}
		return violations;
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
	public language_class_refs(
		sources: readonly LintSourceRecordData[],
		language: AstLanguage,
		stage_timer: LintStageTimerContract,
	): ViolationContract[] {
		const parsed = sources
			.filter((source) => source.language === language)
			.filter((source) => !this._test_path_syntax.classify(source.relative_path).has(TestPathKind.TestFile))
			.map((source) => ({
				file: source.relative_path,
				ast: source.normalized_ast,
			}));
		const references_by_class = stage_timer.measure("class-reference-metric.index", () =>
			this.collect_references(parsed),
		);
		return parsed.flatMap((file) => this.file_violations(file, references_by_class, stage_timer));
	}
}
