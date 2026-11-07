import { CONSTRUCTOR_NAME, PYTHON_CONSTRUCTOR_NAME, SHARED_PARAMETER_REFERENCE_KIND } from "src/metrics/constants";
import { ProjectBoundaryProjectTypes } from "src/metrics/project_boundary_project_types";
import { ProjectBoundaryTypeMembership } from "src/metrics/project_boundary_type_membership";
import { SharedParameterAnalyzer } from "src/metrics/shared_parameter/shared_parameter_analyzer";
import { SharedParameterReporter } from "src/metrics/shared_parameter/shared_parameter_reporter";
import { SharedParameterType } from "src/metrics/shared_parameter/shared_parameter_type";
import type {
	AnalyzedCallable,
	AnalyzedParameter,
	CallableLocation,
	SharedParameterAdapterContract,
	SharedParameterTypeContract,
} from "src/metrics/types";
import type { SharedParameterAnalysisInput } from "src/metrics/types";
import type { AstCallableNode, AstTypedArgument } from "src/model/ast/normalized_ast_types";
import type { ViolationContract } from "src/reporting_protocols";

/** Responsibilities: _callable input normalization_, _shared parameter diagnostics_. **/
export class SharedParameterAdapter implements SharedParameterAdapterContract {
	private readonly _input: SharedParameterAnalysisInput;
	private readonly _parameter_type: SharedParameterTypeContract;

	/** Responsibilities: _identification receiver parameters excluded_. **/
	private receiver_argument(has_self: boolean, argument: AstTypedArgument): boolean {
		if (argument.name === "this") {
			return true;
		}
		if (has_self) {
			return argument.name === "self";
		}
		return false;
	}

	/** Responsibilities: _constructor signature exclusion_. **/
	private constructor_callable(callable_name: string): boolean {
		if (callable_name === CONSTRUCTOR_NAME) {
			return true;
		}
		return callable_name === PYTHON_CONSTRUCTOR_NAME;
	}

	/** Responsibilities: _typed arguments analysis adaptation_. **/
	private parameters(node: AstCallableNode): AnalyzedParameter[] {
		const parameters: AnalyzedParameter[] = [];
		const uses = new Map(node.signature.argument_uses.map((item) => [item.name, item.count]));
		for (const argument of node.signature.typed_arguments) {
			if (this.receiver_argument(node.declaration.has_self, argument)) {
				continue;
			}
			for (const parameter of this._parameter_type.parameter(argument, uses)) {
				parameters.push(this.scoped_parameter(parameter));
			}
		}
		return parameters;
	}

	/** Responsibilities: _source callable metadata adaptation_. **/
	private location(callable_name: string, owner_name: string, start_line: number): CallableLocation {
		let method = callable_name;
		if (this._input.kind === "method") {
			method = `${owner_name}.${callable_name}`;
		}
		return {
			file: this._input.file.split("\\").join("/"),
			line: start_line + 1,
			method,
		};
	}

	/** Responsibilities: _source-scoped parameter key_. **/
	private scoped_parameter(parameter: AnalyzedParameter): AnalyzedParameter {
		if (parameter.kind !== SHARED_PARAMETER_REFERENCE_KIND) {
			return parameter;
		}
		const separator = parameter.identity.indexOf(":");
		if (separator < 0) {
			return parameter;
		}
		const name = parameter.identity.slice(0, separator);
		return {
			...parameter,
			key: parameter.type_identity.scoped_key(parameter.kind, name, this._input.file, this._input.type_sources),
		};
	}

	/** Responsibilities: _initialization shared-parameter analysis input_. **/
	public constructor(input: SharedParameterAnalysisInput) {
		this._input = input;
		this._parameter_type = new SharedParameterType(
			input.reference_aliases,
			new ProjectBoundaryProjectTypes(input.project_types, new Set<string>()),
			new ProjectBoundaryTypeMembership(new Set(), new Set(), new Set(), new Set(), false),
			input.language,
		);
	}

	/** Responsibilities: _input nodes analysis conversion_. **/
	public callables(): AnalyzedCallable[] {
		const callables: AnalyzedCallable[] = [];
		for (const node of this._input.nodes) {
			if (this._input.kind === "method" && this.constructor_callable(node.identity.name)) {
				continue;
			}
			callables.push({
				kind: this._input.kind,
				language: this._input.language,
				location: this.location(node.identity.name, node.identity.owner, node.identity.start),
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
