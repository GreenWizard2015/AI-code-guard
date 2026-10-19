import type { ViolationContract } from "src/protocols";
import type { AstTypedArgument } from "src/types";
import { SharedParameterAnalyzer } from "src/metrics/shared_parameter_analyzer";
import type {
	AnalyzedCallable,
	AnalyzedParameter,
	CallableLocation,
	SharedParameterNodeInput,
	SharedParameterTypeContract,
} from "src/metrics/types";
import type { SharedParameterAnalysisInput } from "src/metrics/types";
import { SharedParameterReporter } from "src/metrics/shared_parameter_reporter";
import { SharedParameterType } from "src/metrics/shared_parameter_type";
import { ProjectBoundaryTypeMembership } from "src/metrics/project-boundary/project_boundary_type_membership";
import { ProjectBoundaryProjectTypes } from "src/metrics/project-boundary/project_boundary_project_types";
import { SHARED_PARAMETER_REFERENCE_KIND, TYPE_SEPARATORS } from "src/metrics/constants";
import type { SharedParameterTypeSource } from "src/metrics/types";

/** Responsibilities: _callable input normalization_, _shared parameter diagnostics_. **/
export class SharedParameterAdapter {
	private readonly input: SharedParameterAnalysisInput;
	private readonly parameter_type: SharedParameterTypeContract;
	private readonly empty_source: SharedParameterTypeSource = { file: "", name: "" };

	/** Responsibilities: _identification receiver parameters excluded_. **/
	private receiver_argument(node: SharedParameterNodeInput, argument: AstTypedArgument): boolean {
		if (argument.name === "this") {
			return true;
		}
		return node.has_self === true && argument.name === "self";
	}

	/** Responsibilities: _typed arguments analysis adaptation_. **/
	private parameters(node: SharedParameterNodeInput): AnalyzedParameter[] {
		const parameters: AnalyzedParameter[] = [];
		const uses = new Map(node.argument_uses.map((item) => [item.name, item.count]));
		for (const argument of node.typed_arguments) {
			if (this.receiver_argument(node, argument)) {
				continue;
			}
			for (const parameter of this.parameter_type.parameter(argument, uses)) {
				parameters.push(this.scoped_parameter(parameter));
			}
		}
		return parameters;
	}

	/** Responsibilities: _source callable metadata adaptation_. **/
	private location(node: SharedParameterNodeInput): CallableLocation {
		let method = node.name;
		if (this.input.kind === "method") {
			method = `${node.owner}.${node.name}`;
		}
		return {
			file: this.input.file.split("\\").join("/"),
			line: node.start + 1,
			method,
		};
	}

	/** Responsibilities: _source-scoped parameter identity_. **/
	private source_for(token: string): SharedParameterTypeSource {
		const local_source = this.input.type_sources.get(JSON.stringify([this.input.file, token]));
		if (local_source !== undefined && local_source.file.length > 0) {
			return local_source;
		}
		const global_source = this.input.type_sources.get(token);
		if (global_source !== undefined && global_source.file.length > 0) {
			return global_source;
		}
		return this.empty_source;
	}

	/** Responsibilities: _scoped type token identity_. **/
	private scoped_token(token: string): string {
		const source = this.source_for(token);
		if (source.file.length === 0) {
			return token;
		}
		return JSON.stringify([source.file, source.name]);
	}

	/** Responsibilities: _generic type identity segments_. **/
	private append_scoped_token(segments: string[], token: string): void {
		if (token.length === 0) {
			return;
		}
		segments.push(this.scoped_token(token));
	}

	/** Responsibilities: _generic type identity segments_. **/
	private scoped_type_segments(type: string): string[] {
		const segments: string[] = [];
		let token = "";
		for (const character of type) {
			if (TYPE_SEPARATORS.includes(character)) {
				this.append_scoped_token(segments, token);
				token = "";
				segments.push(character);
				continue;
			}
			token += character;
		}
		this.append_scoped_token(segments, token);
		return segments;
	}

	/** Responsibilities: _source-scoped parameter key_. **/
	private scoped_parameter(parameter: AnalyzedParameter): AnalyzedParameter {
		if (parameter.kind !== SHARED_PARAMETER_REFERENCE_KIND) {
			return parameter;
		}
		return {
			...parameter,
			key: JSON.stringify([parameter.kind, this.scoped_type_segments(parameter.identity).join("")]),
		};
	}

	/** Responsibilities: _initialization shared-parameter analysis input_. **/
	public constructor(input: SharedParameterAnalysisInput) {
		this.input = input;
		this.parameter_type = new SharedParameterType(
			input.reference_aliases,
			new ProjectBoundaryProjectTypes(input.project_types, new Set<string>()),
			input.language,
			new ProjectBoundaryTypeMembership(new Set(), new Set(), new Set(), new Set(), false),
		);
	}

	/** Responsibilities: _input nodes analysis conversion_. **/
	public callables(): AnalyzedCallable[] {
		const callables: AnalyzedCallable[] = [];
		for (const node of this.input.nodes) {
			if (this.input.kind === "method" && node.visibility === "private") {
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
	public violations(): ViolationContract[] {
		const analyzer = new SharedParameterAnalyzer(this.callables());
		const reporter = new SharedParameterReporter(analyzer.collect_candidates());
		return reporter.violations();
	}
}
