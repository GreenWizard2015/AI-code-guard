import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { LintFileName } from "src/core/context/lint_file_name";
import { ClassStructureReporter } from "src/metrics/class_structure_reporter";
import { EMPTY_MUTATED_FIELDS } from "src/metrics/constants";
import type { ClassStateEvidence, ClassStructureProjectNames, ClassStructureReporterOptions } from "src/metrics/types";
import type { AstClassNode } from "src/model/ast/normalized_ast_types";
import type { ViolationContract } from "src/reporting_protocols";
import { MethodOrder } from "src/rules/method_order";
import { TypeScriptClassFieldClassifier } from "src/rules/typescript/syntax-rules/ast/verifier/class-state/type_script_class_field_classifier";
import { TypeScriptClassFieldUsage } from "src/rules/typescript/syntax-rules/ast/verifier/class-state/type_script_class_field_usage";
import { TypeScriptClassMetricsSourceIndex } from "src/rules/typescript/syntax-rules/ast/verifier/class-state/type_script_class_metrics_source_index";
import { TypeScriptClassMutationAnalysis } from "src/rules/typescript/syntax-rules/ast/verifier/class-state/type_script_class_mutation_analysis";
import { TypeScriptConstructorState } from "src/rules/typescript/syntax-rules/ast/verifier/class-state/type_script_constructor_state";
import type {
	TypeScriptClassMetricsSource,
	TypeScriptClassMetricsSourceIndexContract,
	TypeScriptClassMetricsSourceInput,
	TypeScriptClassMetricsTarget,
} from "src/rules/typescript/syntax-rules/types";
import type { RuleContextContract, RuleContextState } from "src/types";
import type {
	TypeScriptNodeVerificationRequest,
	TypeScriptSourceVerificationRequest,
} from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _class metric diagnostics_, _class method ordering_. **/
export class TypeScriptClassMetrics implements ASTSourceRuleContract {
	private readonly _collection_mutators: ReadonlySet<string>;
	private readonly _source_index: TypeScriptClassMetricsSourceIndexContract;
	private readonly _declarations_by_context: WeakMap<RuleContextContract, ts.Node[]>;

	/** Responsibilities: _readonly collection mutation lookup_. **/
	private mutated_readonly_fields(declaration: ts.ClassLikeDeclaration): ReadonlySet<string> {
		const analysis = new TypeScriptClassMutationAnalysis(declaration, this._collection_mutators);
		const immutable_fields = analysis.immutable_fields();
		if (immutable_fields.size === 0) {
			return immutable_fields;
		}
		return analysis.mutated_fields();
	}

	/** Responsibilities: _constructor state retention_. **/
	private constructor_injected_state(declaration: ts.Node): boolean {
		if (!ts.isClassLike(declaration)) {
			return false;
		}
		const classifier = new TypeScriptClassFieldClassifier(declaration);
		if (classifier.delegates_collection()) {
			return true;
		}
		const field_usage = new TypeScriptClassFieldUsage(declaration);
		const field_reads = field_usage.collect();
		const constructor_state = new TypeScriptConstructorState(declaration, classifier, field_reads);
		if (constructor_state.retains_dependency()) {
			return true;
		}
		return constructor_state.retains_value_invariant();
	}

	/** Responsibilities: _class state evidence_. **/
	private class_state_evidence(
		declaration: ts.Node,
		node: AstClassNode,
		source_metrics: TypeScriptClassMetricsSource,
		source_file: ts.SourceFile,
	): ClassStateEvidence {
		return {
			inherited_instance_state: source_metrics.inherited_state_nodes.has(
				`${source_file.fileName}\u0000${node.identity.name}`,
			),
			constructor_injected_state: this.constructor_injected_state(declaration),
			inherited_state_names: new Set<string>(),
		};
	}

	/** Responsibilities: _project class names_. **/
	private class_project_names(context_state: RuleContextState): ClassStructureProjectNames {
		const { project_names } = context_state.project;
		return {
			project_class_names: project_names.project_class_names,
			project_contract_names: project_names.project_contract_names,
			project_alias_names: project_names.project_alias_names,
		};
	}

	/** Responsibilities: _class structure reporter options_. **/
	private class_reporter_options(
		context_state: RuleContextState,
		target: TypeScriptClassMetricsTarget,
		violations: ViolationContract[],
	): ClassStructureReporterOptions {
		const { declaration, node, source_metrics } = target;
		const {
			source: { file, source_file },
		} = context_state;
		let mutated_readonly_fields = EMPTY_MUTATED_FIELDS;
		if (ts.isClassLike(declaration)) {
			mutated_readonly_fields = this.mutated_readonly_fields(declaration);
		}
		return {
			violations,
			file_name: new LintFileName(file),
			node,
			suppress_short_class: source_metrics.suppress_short_class,
			mutated_readonly_fields,
			...this.class_project_names(context_state),
			class_state: this.class_state_evidence(declaration, node, source_metrics, source_file),
		};
	}

	/** Responsibilities: _source class metric reporting_. **/
	private report_source_classes(
		context: RuleContextContract,
		declarations: readonly ts.Node[],
		source_file: ts.SourceFile,
		source_metrics: TypeScriptClassMetricsSource,
	): void {
		for (const declaration of declarations) {
			const node = source_metrics.classes_by_position.get(declaration.getStart(source_file));
			if (node !== undefined) {
				this.report_class_metrics(context, { declaration, node, source_metrics });
			}
		}
	}

	/** Responsibilities: _class metrics reporting_. **/
	private report_class_metrics(report_context: RuleContextContract, target: TypeScriptClassMetricsTarget): void {
		const {
			source: { file },
		} = report_context.state();
		const violations: ViolationContract[] = [];
		const reporter_options = this.class_reporter_options(report_context.state(), target, violations);
		const reporter = new ClassStructureReporter(reporter_options);
		reporter.report_class(false);
		this.append_method_order(file, target.node, violations);
		for (const violation of violations) {
			report_context.append_violation(violation);
		}
	}

	/** Responsibilities: _class method order reporting_. **/
	private append_method_order(file: string, node: AstClassNode, violations: ViolationContract[]): void {
		if (node.classification.extends_external_class) {
			return;
		}
		const method_order = new MethodOrder(file, node);
		method_order.append_order(violations);
	}

	/** Responsibilities: _class rule initialization_. **/
	public constructor() {
		this._collection_mutators = new Set([
			"add",
			"clear",
			"close",
			"delete",
			"dispose",
			"fill",
			"pop",
			"push",
			"reverse",
			"set",
			"shift",
			"sort",
			"splice",
			"unshift",
		]);
		this._source_index = new TypeScriptClassMetricsSourceIndex(this._collection_mutators);
		this._declarations_by_context = new WeakMap();
	}

	/** Responsibilities: _class metric rule activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.includes("class");
	}

	/** Responsibilities: _class declaration collection_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		let declarations = this._declarations_by_context.get(request.context);
		if (declarations === undefined) {
			declarations = [];
			this._declarations_by_context.set(request.context, declarations);
		}
		declarations.push(request.node);
	}

	/** Responsibilities: _class metric source reporting_. **/
	public finish_source(request: TypeScriptSourceVerificationRequest): void {
		const { context } = request;
		const declarations = this._declarations_by_context.get(context);
		this._declarations_by_context.delete(context);
		if (declarations === undefined) {
			return;
		}
		const source = context.state().source;
		const source_input: TypeScriptClassMetricsSourceInput = {
			source_file: source.source_file,
			normalized_ast: source.normalized_ast,
			declarations,
		};
		const source_metrics = this._source_index.source_metrics(context, source_input);
		this.report_source_classes(context, declarations, source_input.source_file, source_metrics);
	}
}
