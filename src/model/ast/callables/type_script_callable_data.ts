import ts from "typescript";

import { CallableBodyMetrics } from "src/model/ast/callables/callable_body_metrics";
import { CallableParameterData } from "src/model/ast/callables/callable_parameter_data";
import type {
	AstCallableIdentity,
	AstCallableMetrics,
	AstCallableNode,
	AstCallableSignature,
	AstCallableTestBehavior,
	AstVisibility,
} from "src/model/ast/normalized_ast_types";
import type { CallableParameterDataContract, TypeScriptCallableDataContract } from "src/model/protocols";
import type { CallableNodeMetrics, SourceLineRange } from "src/model/types";
import type { CallableBodyMetricsContract } from "src/runtime_protocols";
import type { CallableMetricComponents, CallableNodeOptions, CallableOptions } from "src/types";
import type { CallableTypeScriptNodeVisitor } from "src/typescript_analysis_types";

/** Responsibilities: _callable identity normalization_, _callable metric extraction_. **/
export class TypeScriptCallableData implements TypeScriptCallableDataContract {
	private readonly _source_file: ts.SourceFile;
	private readonly _body_metrics: CallableBodyMetricsContract;
	private readonly _parameter_data: CallableParameterDataContract;
	private readonly _property_name_kinds: ReadonlySet<ts.SyntaxKind>;

	/** Responsibilities: _property-name classification_. **/
	private property_name(node: ts.Identifier): boolean {
		if (!this._property_name_kinds.has(node.parent.kind)) {
			return false;
		}
		if (!ts.isPropertyAccessExpression(node.parent) && !ts.isPropertyAssignment(node.parent)) {
			return false;
		}
		return node.parent.name === node;
	}

	/** Responsibilities: _argument-read counts_. **/
	private increment_argument_reads(counts: Map<string, number>, node: ts.Node): void {
		if (!ts.isIdentifier(node)) {
			return;
		}
		if (!counts.has(node.text)) {
			return;
		}
		if (this.property_name(node)) {
			return;
		}
		const count = counts.get(node.text);
		if (count !== undefined) {
			counts.set(node.text, count + 1);
		}
	}

	/** Responsibilities: _callable body traversal_. **/
	private visit_argument_body(body_callable: ts.SignatureDeclarationBase, visit: CallableTypeScriptNodeVisitor): void {
		const last_child = body_callable.getChildren().at(-1);
		if (last_child !== undefined && (ts.isBlock(last_child) || ts.isExpression(last_child))) {
			visit(last_child);
		}
	}

	/** Responsibilities: _argument-read data_. **/
	private argument_reads(read_callable: ts.SignatureDeclarationBase): { name: string; count: number }[] {
		const counts = new Map<string, number>();
		for (const parameter of read_callable.parameters) {
			if (ts.isIdentifier(parameter.name)) {
				counts.set(parameter.name.text, 0);
			}
		}
		if (!ts.isFunctionLike(read_callable)) {
			const entries = [...counts];
			return entries.map(([name, count]) => ({ name, count }));
		}
		const visit = (child: ts.Node): void => {
			this.increment_argument_reads(counts, child);
			ts.forEachChild(child, visit);
		};
		this.visit_argument_body(read_callable, visit);
		const entries = [...counts];
		return entries.map(([name, count]) => ({ name, count }));
	}

	/** Responsibilities: _normalization callable visibility preservation_. **/
	private callable_visibility(name: string, visibility: AstVisibility): AstVisibility {
		if (visibility === "public" && name.startsWith("_")) {
			return "private";
		}
		return visibility;
	}

	/** Responsibilities: _collection metric components callable_. **/
	private metric_components(metric_callable: ts.SignatureDeclarationBase): CallableMetricComponents {
		return {
			lines: this._body_metrics.lines(metric_callable),
			sloc: this._body_metrics.sloc(metric_callable),
			characters: this._body_metrics.characters(metric_callable),
			control_flow_depth: this._body_metrics.control_flow_depth(metric_callable),
			argument_uses: this.argument_reads(metric_callable),
			typed_arguments: this._parameter_data.typed_arguments(metric_callable),
		};
	}

	/** Responsibilities: _line SLOC character assembly_. **/
	private node_metrics(metrics_callable: ts.SignatureDeclarationBase): CallableNodeMetrics {
		return {
			...this.metric_components(metrics_callable),
			argument_count: metrics_callable.parameters.length,
			...this._parameter_data.type_data(metrics_callable),
		};
	}

	/** Responsibilities: _callable identity construction_. **/
	private node_identity(options: CallableNodeOptions): AstCallableIdentity {
		return {
			name: options.name,
			owner: options.owner,
			nested: false,
			start: options.start,
			end: options.end,
			visibility: this.callable_visibility(options.name, options.visibility),
		};
	}

	/** Responsibilities: _callable measured values_. **/
	private node_metric_values(metrics: CallableNodeMetrics): AstCallableMetrics {
		return {
			argument_count: metrics.argument_count,
			lines: metrics.lines,
			sloc: metrics.sloc,
			characters: metrics.characters,
			control_flow_depth: metrics.control_flow_depth,
		};
	}

	/** Responsibilities: _callable parameter metadata_. **/
	private node_signature(metrics: CallableNodeMetrics): AstCallableSignature {
		return {
			statements: [],
			untyped_parameters: [],
			return_type: metrics.return_type,
			parameter_types: metrics.parameter_types,
			argument_uses: metrics.argument_uses,
			typed_arguments: metrics.typed_arguments,
		};
	}

	/** Responsibilities: _callable test behavior metadata_. **/
	private node_test_behavior(node: ts.SignatureDeclarationBase): AstCallableTestBehavior {
		return {
			exception_only: this._body_metrics.exception_only(node),
			has_unittest_assertion: false,
			unittest_assertion_alias: false,
			unittest_exception_only: false,
			test_exception_bypass: false,
			unittest_ending_valid: false,
			unittest_assertion_count: 0,
		};
	}

	/** Responsibilities: _construction normalization callable node_. **/
	private build_node(options: CallableNodeOptions): AstCallableNode {
		const { node } = options;
		const metrics = this.node_metrics(node);
		return {
			identity: this.node_identity(options),
			metrics: this.node_metric_values(metrics),
			signature: this.node_signature(metrics),
			test_behavior: this.node_test_behavior(node),
			declaration: { decorators: [], parameterized_case_count: 0, is_accessor: false, has_self: false },
		};
	}

	/** Responsibilities: _initialization source metrics parameter-data_. **/
	public constructor(source_file: ts.SourceFile) {
		this._source_file = source_file;
		this._property_name_kinds = new Set([ts.SyntaxKind.PropertyAccessExpression, ts.SyntaxKind.PropertyAssignment]);
		this._body_metrics = new CallableBodyMetrics(source_file);
		this._parameter_data = new CallableParameterData(source_file);
	}

	/** Responsibilities: _calculation source line range_. **/
	public source_line_range(node: ts.SignatureDeclarationBase): SourceLineRange {
		const start_position = node.getStart(this._source_file);
		const end_position = Math.max(start_position, node.end - 1);
		const start = this._source_file.getLineAndCharacterOfPosition(start_position).line;
		const end = this._source_file.getLineAndCharacterOfPosition(end_position).line;
		return { start, end };
	}

	/** Responsibilities: _construction normalization callable node_. **/
	public callable_node(options: CallableOptions): AstCallableNode {
		const { name, owner, node, visibility } = options;
		const range = this.source_line_range(node);
		return this.build_node({ name, owner, node, visibility, start: range.start, end: range.end });
	}
}
