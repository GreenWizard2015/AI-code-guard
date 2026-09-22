import type { Violation } from 'src/protocols';
import type { AstTypedArgument } from 'src/types';
import { SharedParameterAnalyzer } from 'src/metrics/shared-parameter-analyzer';
import type {
	AnalyzedCallable,
	AnalyzedParameter,
	CallableLocation,
	SharedParameterNodeInput,
} from 'src/metrics/types';
import type { SharedParameterAnalysisInput } from 'src/metrics/types';
import { SharedParameterReporter } from 'src/metrics/shared-parameter-reporter';
import { SharedParameterType } from 'src/metrics/shared-parameter-type';

/** Responsibilities: _normalization callable inputs adaptation_. **/
export class SharedParameterAdapter {
	private readonly input: SharedParameterAnalysisInput;
	private readonly parameter_type: SharedParameterType;

	/** Responsibilities: _identification receiver parameters excluded_. **/
	private receiver_argument(node: SharedParameterNodeInput, argument: AstTypedArgument): boolean {
		if (argument.name === 'this') {
			return true;
		}
		return node.has_self === true && argument.name === 'self';
	}

	/** Responsibilities: _typed arguments analysis adaptation_. **/
	private parameters(node: SharedParameterNodeInput): AnalyzedParameter[] {
		const parameters: AnalyzedParameter[] = [];
		const uses = new Map(node.argument_uses.map(item => [item.name, item.count]));
		for (const argument of node.typed_arguments) {
			if (this.receiver_argument(node, argument)) {
				continue;
			}
			parameters.push(...this.parameter_type.parameter(argument, uses));
		}
		return parameters;
	}

	/** Responsibilities: _source callable metadata adaptation_. **/
	private location(node: SharedParameterNodeInput): CallableLocation {
		let method = node.name;
		if (this.input.kind === 'method') {
			method = `${node.owner}.${node.name}`;
		}
		return {
			file: this.input.file.split('\\').join('/'),
			line: node.start + 1,
			method,
		};
	}

	/** Responsibilities: _initialization shared-parameter analysis input_. **/
	public constructor(input: SharedParameterAnalysisInput) {
		this.input = input;
		this.parameter_type = new SharedParameterType(
			input.reference_aliases,
			input.project_types,
			input.language
		);
	}

	/** Responsibilities: _input nodes analysis conversion_. **/
	public callables(): AnalyzedCallable[] {
		const callables: AnalyzedCallable[] = [];
		for (const node of this.input.nodes) {
if (this.input.kind === 'method' && node.visibility === 'private') {
				continue;
			}
			callables.push({
				kind: this.input.kind,
				language: this.input.language,
				location: this.location(node),
				parameters: this.parameters(node),
			});
		}
		return callables;
	}

	/** Responsibilities: _analysis adapted callables output_. **/
	public violations(): Violation[] {
		const analyzer = new SharedParameterAnalyzer(this.callables());
		const reporter = new SharedParameterReporter(analyzer.collect_candidates());
		return reporter.violations();
	}
}
