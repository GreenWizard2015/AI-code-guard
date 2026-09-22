import ts from 'typescript';

import { CallableBodyMetrics } from 'src/model/typescript-callable-body-metrics';
import { CallableParameterData } from 'src/model/typescript-callable-parameter-data';
import { TypeScriptArgumentUsage } from 'src/bridge/ts/parser/typescript-argument-usage';
import type { AstCallableNode, AstVisibility, CallableMetricComponents, CallableNodeOptions, CallableOptions } from 'src/types';
import type { SourceLineRange, CallableNodeMetrics } from 'src/model/types';


/** Responsibilities: _construction normalization callable identity_. **/
export class TypeScriptCallableData {
	private readonly source_file: ts.SourceFile;
	private readonly body_metrics: CallableBodyMetrics;
	private readonly parameter_data: CallableParameterData;
	private readonly argument_usage = new TypeScriptArgumentUsage();

	/** Responsibilities: _normalization callable visibility preservation_. **/
	private callable_visibility(name: string, visibility: AstVisibility): AstVisibility {
		if (visibility === 'public' && name.startsWith('_')) {
			return 'private';
		}
		return visibility;
	}

	/** Responsibilities: _collection metric components callable_. **/
	private metric_components(node: ts.SignatureDeclarationBase): CallableMetricComponents {
		return {
			lines: this.body_metrics.lines(node),
			sloc: this.body_metrics.sloc(node),
			characters: this.body_metrics.characters(node),
			argument_uses: this.argument_usage.collect_argument_usage(node),
			typed_arguments: this.parameter_data.typed_arguments(node),
		};
	}

	/** Responsibilities: _line SLOC character assembly_. **/
	private node_metrics(
		node: ts.SignatureDeclarationBase
	): CallableNodeMetrics {
		return {
			...this.metric_components(node),
			argument_count: node.parameters.length,
			...this.parameter_data.type_data(node),
		};
	}

	/** Responsibilities: _construction normalization callable node_. **/
	private build_node(options: CallableNodeOptions): AstCallableNode {
		const { name, owner, node, visibility, start, end } = options;
		return {
			name,
			owner,
			start,
			end,
			...this.node_metrics(node),
			exception_only: this.body_metrics.exception_only(node),
			statements: [],
			untyped_parameters: [],
			return_type: this.parameter_data.type_data(node).return_type,
			decorators: [],
			is_accessor: false,
			has_self: false,
			has_unittest_assertion: false,
			unittest_exception_only: false,
			test_exception_bypass: false,
			unittest_ending_valid: false,
			unittest_assertion_count: 0,
			visibility: this.callable_visibility(name, visibility),
		};
	}

	/** Responsibilities: _initialization source metrics parameter-data_. **/
	public constructor(source_file: ts.SourceFile) {
		this.source_file = source_file;
		this.body_metrics = new CallableBodyMetrics(source_file);
		this.parameter_data = new CallableParameterData(source_file);
	}

	/** Responsibilities: _calculation source line range_. **/
	public source_line_range(node: ts.SignatureDeclarationBase): SourceLineRange {
		const start_position = node.getStart(this.source_file);
		const end_position = Math.max(start_position, node.end - 1);
		const start = this.source_file.getLineAndCharacterOfPosition(start_position).line;
		const end = this.source_file.getLineAndCharacterOfPosition(end_position).line;
		return { start, end };
	}

	/** Responsibilities: _construction normalization callable node_. **/
	public callable_node(options: CallableOptions): AstCallableNode {
		const { name, owner, node, visibility } = options;
		const range = this.source_line_range(node);
		return this.build_node({ name, owner, node, visibility, start: range.start, end: range.end });
	}
}
