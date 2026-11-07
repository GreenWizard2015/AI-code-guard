import { SHARED_PARAMETER_REFERENCE_KIND, TYPE_SEPARATORS } from "src/metrics/constants";
import { READONLY_BUILTIN_TYPES, UNDEFINED_TYPE_NAME } from "src/metrics/constants";
import { SharedParameterTypeIdentity } from "src/metrics/shared_parameter/shared_parameter_type_identity";
import type {
	AnalyzedParameter,
	ProjectTypeNameMembershipContract,
	SharedParameterKind,
	SharedParameterLanguage,
	SharedParameterTypeContract,
	SharedParameterTypeIdentityContract,
	StringNameMembershipContract,
	TypeSyntaxSegment,
	TypeSyntaxSegmentKind,
} from "src/metrics/types";
import type { ParameterKindResult } from "src/metrics/types";
import type { AstReferenceAlias, AstTypedArgument } from "src/model/ast/normalized_ast_types";

/** Responsibilities: _parameter type classification_, _project type canonicalization_. **/
export class SharedParameterType implements SharedParameterTypeContract {
	private readonly _aliases: ReadonlyMap<string, string>;
	private readonly _project_types: ProjectTypeNameMembershipContract;
	private readonly _allowed_types: StringNameMembershipContract;
	private readonly _language: SharedParameterLanguage;
	private readonly _builtin_types: Set<string>;
	private readonly _python_builtin_types: Set<string>;

	/** Responsibilities: _tooling type category_. **/
	private tooling_type(type_name: string): boolean {
		if (this._builtin_types.has(type_name)) {
			return true;
		}
		if (this._language === "python" && this._python_builtin_types.has(type_name)) {
			return true;
		}
		return false;
	}

	/** Responsibilities: _argument usage count access_. **/
	private use_count(counted_argument: AstTypedArgument, name_counts: ReadonlyMap<string, number>): number {
		const count = name_counts.get(counted_argument.name);
		if (count === undefined) {
			return 0;
		}
		return count;
	}

	/** Responsibilities: _typed arguments classification_. **/
	private parameter_kind(input_argument: AstTypedArgument, annotation: string): ParameterKindResult {
		if (input_argument.kind === "basic") {
			return { supported: true, value: "basic" };
		}
		if (annotation.length > 0) {
			return { supported: true, value: SHARED_PARAMETER_REFERENCE_KIND };
		}
		return { supported: false, value: "basic" };
	}

	/** Responsibilities: _primitive parameter type recognition_. **/
	private primitive_type(primitive_name: string): boolean {
		if (this._language === "python") {
			return ["bool", "bytes", "complex", "float", "int", "str"].includes(primitive_name);
		}
		return ["bigint", "boolean", "number", "string", "symbol"].includes(primitive_name);
	}

	/** Responsibilities: _parameter record construction_. **/
	private parameter_result(
		parameter_argument: AstTypedArgument,
		type_identity: SharedParameterTypeIdentityContract,
		kind: SharedParameterKind,
		parameter_frequency: ReadonlyMap<string, number>,
	): AnalyzedParameter[] {
		const normalized_type = type_identity.canonical();
		const identity = `${parameter_argument.name}:${normalized_type}`;
		return [
			{
				key: identity,
				identity,
				type_identity,
				kind,
				primitive: kind === "basic" && this.primitive_type(normalized_type),
				project_type: this.is_project_reference(kind, type_identity),
				uses: this.use_count(parameter_argument, parameter_frequency),
			},
		];
	}

	/** Responsibilities: _project parameter type classification_. **/
	private is_project_reference(
		reference_kind: SharedParameterKind,
		reference_type: SharedParameterTypeIdentityContract,
	): boolean {
		if (reference_kind !== SHARED_PARAMETER_REFERENCE_KIND) {
			return false;
		}
		return this.project_type_expression(reference_type);
	}

	/** Responsibilities: _project type token classification_. **/
	private project_type_token(name: string): boolean {
		if (this._allowed_types.present(name)) {
			return false;
		}
		return this._project_types.contains(name);
	}

	/** Responsibilities: _project type expression classification_. **/
	private project_type_expression(expression: SharedParameterTypeIdentityContract): boolean {
		const names = expression.reference_names();
		const custom_names = names.filter((name) => !this.tooling_type(name));
		if (custom_names.length === 0) {
			return false;
		}
		if (this._project_types.contains(expression.canonical())) {
			return true;
		}
		return custom_names.some((name) => this.project_type_token(name));
	}

	/** Responsibilities: _type context initialization_. **/
	public constructor(
		reference_aliases: readonly AstReferenceAlias[],
		project_types: ProjectTypeNameMembershipContract,
		allowed_types: StringNameMembershipContract,
		language: SharedParameterLanguage = "unknown",
	) {
		this._builtin_types = new Set([
			"Array",
			"BigInt",
			"Boolean",
			"Date",
			"Error",
			"Map",
			"Number",
			"Object",
			"Promise",
			"Record",
			...READONLY_BUILTIN_TYPES,
			"Set",
			"String",
			"Uint8Array",
			"unknown",
			"boolean",
			"never",
			"number",
			"object",
			"string",
			"symbol",
			UNDEFINED_TYPE_NAME,
			"void",
		]);
		this._python_builtin_types = new Set(["Path", "dict", "frozenset", "list", "set", "tuple"]);
		this._project_types = project_types;
		this._allowed_types = allowed_types;
		this._aliases = new Map(reference_aliases.map((alias) => [alias.name, alias.target]));
		this._language = language;
	}

	/** Responsibilities: _shared parameter type identity_. **/
	public identity(type_syntax: string): SharedParameterTypeIdentityContract {
		const tokens =
			type_syntax
				.trim()
				.match(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[<>[\](),|&?.:]|[^\s<>[\](),|&?.:'"`]+/g) ?? [];
		const segments = tokens.map((token): TypeSyntaxSegment => {
			let kind: TypeSyntaxSegmentKind = SHARED_PARAMETER_REFERENCE_KIND;
			if (token.startsWith("'") || token.startsWith('"') || token.startsWith("`")) {
				kind = "literal";
			} else if (TYPE_SEPARATORS.includes(token)) {
				kind = "separator";
			}
			return { kind, value: token };
		});
		return new SharedParameterTypeIdentity(segments, this._aliases);
	}

	/** Responsibilities: _type references identification projection_. **/
	public project_reference(candidate_expression: string): boolean {
		if (this._allowed_types.present(candidate_expression)) {
			return false;
		}
		const identity = this.identity(candidate_expression);
		return this.project_type_expression(identity);
	}

	/** Responsibilities: _analyze shared parameter_. **/
	public parameter(
		input_argument: AstTypedArgument,
		callable_argument_uses: ReadonlyMap<string, number>,
	): AnalyzedParameter[] {
		const type_identity = this.identity(input_argument.type);
		const normalized_type = type_identity.canonical();
		const kind = this.parameter_kind(input_argument, normalized_type);
		if (!kind.supported) {
			return [];
		}
		return this.parameter_result(input_argument, type_identity, kind.value, callable_argument_uses);
	}
}
