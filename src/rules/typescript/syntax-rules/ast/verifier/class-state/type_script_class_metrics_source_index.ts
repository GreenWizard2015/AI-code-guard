import { MIN_FILE_LINES } from "src/constants";
import { DirectoryCommentSegments } from "src/core/support/directory_comment_segments";
import type { AstClassNode, NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import { TypeScriptInheritedStateClassNames } from "src/rules/typescript/syntax-rules/ast/verifier/inherited-state/type_script_inherited_state_class_names";
import type {
	ProjectClassMetricsState,
	TypeScriptClassMetricsBuildInput,
	TypeScriptClassMetricsSource,
	TypeScriptClassMetricsSourceIndexContract,
	TypeScriptClassMetricsSourceInput,
	TypeScriptInheritedStateClassNamesContract,
} from "src/rules/typescript/syntax-rules/types";
import type { DirectoryCommentSegmentsContract } from "src/shared_services_protocols";
import type { RuleContextContract, RuleContextState } from "src/types";

/** Responsibilities: _class metric source index_, _source metric cache_. **/
export class TypeScriptClassMetricsSourceIndex implements TypeScriptClassMetricsSourceIndexContract {
	private readonly _segments: DirectoryCommentSegmentsContract;
	private readonly _inherited_state_names: TypeScriptInheritedStateClassNamesContract;
	private readonly _source_cache: WeakMap<RuleContextContract, TypeScriptClassMetricsSource>;

	/** Responsibilities: _source class position lookup_. **/
	private classes_by_position(source_input: TypeScriptClassMetricsSourceInput): Map<number, AstClassNode> {
		const { source_file, normalized_ast, declarations } = source_input;
		const classes_by_position = new Map<number, AstClassNode>();
		for (let index = 0; index < declarations.length; index += 1) {
			const declaration = declarations[index];
			const class_node = normalized_ast.source.classes[index];
			if (declaration !== undefined && class_node !== undefined) {
				classes_by_position.set(declaration.getStart(source_file), class_node);
			}
		}
		return classes_by_position;
	}

	/** Responsibilities: _project class state metrics_. **/
	private project_class_state(
		context_state: RuleContextState,
		normalized_ast: NormalizedAstFile,
	): ProjectClassMetricsState {
		const runtime_class_count = normalized_ast.source.classes.filter(
			(item) => !item.classification.type_contract && !item.classification.protocol,
		).length;
		const { rule_scope } = context_state.project;
		let inherited_state_nodes: ReadonlySet<string> = new Set();
		if (rule_scope.project_scope()) {
			inherited_state_nodes = this._inherited_state_names.collect(rule_scope.project_analysis());
		}
		return { runtime_class_count, inherited_state_nodes };
	}

	/** Responsibilities: _source class metric construction_. **/
	private build_source_metrics(input: TypeScriptClassMetricsBuildInput): TypeScriptClassMetricsSource {
		const { context_state, source_input } = input;
		const classes_by_position = this.classes_by_position(source_input);
		const project_state = this.project_class_state(context_state, source_input.normalized_ast);
		const enough_runtime_classes = project_state.runtime_class_count >= 2;
		const source_is_short = this._segments.count_code_lines(source_input.source_file.text, false, []) < MIN_FILE_LINES;
		return {
			classes_by_position,
			...project_state,
			suppress_short_class: enough_runtime_classes && source_is_short,
		};
	}

	/** Responsibilities: _source metric dependencies_. **/
	public constructor(collection_mutators: ReadonlySet<string>) {
		this._segments = new DirectoryCommentSegments("/*", "*/", "#", "//");
		this._inherited_state_names = new TypeScriptInheritedStateClassNames(collection_mutators);
		this._source_cache = new WeakMap();
	}

	/** Responsibilities: _cached source metric access_. **/
	public source_metrics(
		cache_context: RuleContextContract,
		source_input: TypeScriptClassMetricsSourceInput,
	): TypeScriptClassMetricsSource {
		const cached = this._source_cache.get(cache_context);
		if (cached !== undefined) {
			return cached;
		}
		const build_input: TypeScriptClassMetricsBuildInput = {
			context_state: cache_context.state(),
			source_input,
		};
		const result = this.build_source_metrics(build_input);
		this._source_cache.set(cache_context, result);
		return result;
	}
}
