import { ProjectTypeBoundary } from "src/metrics/project_type_boundary";
import type {
	ProjectTypeBoundaryNames as ProjectBoundaryNamesData,
	ProjectTypeBoundarySource,
	TypeScriptProjectBoundaryNamesContract,
} from "src/metrics/types";
import type { AstCallableNode, AstClassField } from "src/model/ast/normalized_ast_types";
import type { ViolationContract } from "src/reporting_protocols";
import { TypeScriptProjectBoundaryNames } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/type_script_project_boundary_names";
import type { RuleContextContract, RuleContextState } from "src/types";

/** Responsibilities: _boundary input construction_, _violation evaluation_, _diagnostic delivery_. **/
export class TypeScriptProjectBoundaryReporter {
	private readonly _names: TypeScriptProjectBoundaryNamesContract;

	/** Responsibilities: _boundary reporting source assembly_. **/
	private source(
		state: RuleContextState,
		callables: readonly AstCallableNode[],
		fields: readonly AstClassField[],
	): ProjectTypeBoundarySource {
		return {
			violations: [],
			file: state.source.file,
			callables,
			fields,
		};
	}

	/** Responsibilities: _boundary violation publication_. **/
	private publish(violations: readonly ViolationContract[], boundary_context: RuleContextContract): void {
		for (const violation of violations) {
			boundary_context.append_violation(violation);
		}
	}

	/** Responsibilities: _boundary name cache setup_. **/
	public constructor() {
		this._names = new TypeScriptProjectBoundaryNames();
	}

	/** Responsibilities: _boundary violation reporting_. **/
	public append(
		boundary_context: RuleContextContract,
		callables: readonly AstCallableNode[],
		fields: readonly AstClassField[],
	): void {
		const state = boundary_context.state();
		const source = this.source(state, callables, fields);
		const violations = this.collect_violations(source, this._names.names(state));
		this.publish(violations, boundary_context);
	}

	/** Responsibilities: _project boundary evaluation_. **/
	public collect_violations(
		source: ProjectTypeBoundarySource,
		names: ProjectBoundaryNamesData,
	): readonly ViolationContract[] {
		const boundary = new ProjectTypeBoundary({ source, names });
		boundary.append();
		return source.violations;
	}
}
