import type { AstClassNode } from "src/model/ast/normalized_ast_types";
import { TypeScriptClassFieldClassifier } from "src/rules/typescript/syntax-rules/ast/verifier/class-state/type_script_class_field_classifier";
import { TypeScriptClassFieldUsage } from "src/rules/typescript/syntax-rules/ast/verifier/class-state/type_script_class_field_usage";
import { TypeScriptClassMutationAnalysis } from "src/rules/typescript/syntax-rules/ast/verifier/class-state/type_script_class_mutation_analysis";
import { TypeScriptConstructorState } from "src/rules/typescript/syntax-rules/ast/verifier/class-state/type_script_constructor_state";
import type { TypeScriptClassFieldClassifierContract } from "src/typescript_analysis_protocols";
import type ts from "typescript";

/** Responsibilities: _direct field state_, _constructor state analysis_. **/
export class TypeScriptDirectClassState {
	private readonly _node: AstClassNode;
	private readonly _syntax_node: ts.ClassLikeDeclaration;
	private readonly _collection_mutators: ReadonlySet<string>;
	private readonly _constructor_classifier: TypeScriptClassFieldClassifierContract;

	/** Responsibilities: _direct state analysis initialization_. **/
	public constructor(
		node: AstClassNode,
		syntax_node: ts.ClassLikeDeclaration,
		collection_mutators: ReadonlySet<string>,
	) {
		this._node = node;
		this._syntax_node = syntax_node;
		this._collection_mutators = collection_mutators;
		this._constructor_classifier = new TypeScriptClassFieldClassifier(syntax_node);
	}

	/** Responsibilities: _mutable field state analysis_. **/
	public retains_mutable_state(): boolean {
		const mutation_analysis = new TypeScriptClassMutationAnalysis(this._syntax_node, this._collection_mutators);
		const mutated_field_names = mutation_analysis.mutated_fields();
		for (const field of this._node.field_analysis.fields) {
			if (field.class_variable || field.class_scope) {
				continue;
			}
			if (!field.readonly || mutated_field_names.has(field.name)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _constructor state classification_. **/
	public retains_constructor_state(): boolean {
		if (this._constructor_classifier.delegates_collection()) {
			return true;
		}
		const field_usage = new TypeScriptClassFieldUsage(this._syntax_node);
		const field_reads = field_usage.collect();
		const constructor_state = new TypeScriptConstructorState(
			this._syntax_node,
			this._constructor_classifier,
			field_reads,
		);
		if (constructor_state.retains_dependency()) {
			return true;
		}
		return constructor_state.retains_value_invariant();
	}

	/** Responsibilities: _instance state classification_. **/
	public stateful_instance(): boolean {
		if (this._node.classification.type_contract || this._node.classification.protocol) {
			return false;
		}
		if (this.retains_mutable_state()) {
			return true;
		}
		return this.retains_constructor_state();
	}
}
