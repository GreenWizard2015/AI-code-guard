import type { AstReferenceAlias, AstTypedArgument } from "src/types";
import type {
	AnalyzedParameter,
	SharedParameterKind,
	SharedParameterLanguage,
	SharedParameterTypeContract,
	StringNameMembershipContract,
	ProjectTypeNameMembershipContract,
} from "src/metrics/types";

import { CONTRACT_SUFFIX, SHARED_PARAMETER_REFERENCE_KIND, TYPE_SEPARATORS } from "src/metrics/constants";
import type { ParameterKindResult } from "src/metrics/types";
import { SharedParameterTooling } from "src/metrics/shared_parameter_tooling";

/** Responsibilities: _parameter type classification_, _project type canonicalization_. **/
export class SharedParameterType implements SharedParameterTypeContract {
	private readonly aliases: ReadonlyMap<string, string>;
	private readonly project_types: ProjectTypeNameMembershipContract;
	private readonly allowed_types: StringNameMembershipContract;
	private readonly language: SharedParameterLanguage;
	private readonly tooling: SharedParameterTooling;

	/** Responsibilities: _type aliases resolution_. **/
	private aliased_token(token: string): string {
		const visited = new Set<string>();
		let resolved = token;
		while (this.aliases.has(resolved)) {
			if (visited.has(resolved)) {
				break;
			}
			visited.add(resolved);
			const target = this.aliases.get(resolved);
			if (target === undefined) {
				break;
			}
			resolved = target;
		}
		return resolved;
	}

	/** Responsibilities: _type token addition_. **/
	private append_token(result: string, token: string): string {
		if (token.length === 0) {
			return result;
		}
		return result + this.aliased_token(token);
	}

	/** Responsibilities: _type references extraction_. **/
	private type_names(type: string): string[] {
		const names: string[] = [];
		let current = "";
		for (const character of type) {
			if (!TYPE_SEPARATORS.includes(character)) {
				current += character;
				continue;
			}
			if (current.length > 0) {
				names.push(current);
				current = "";
			}
		}
		if (current.length > 0) {
			names.push(current);
		}
		return names;
	}

	/** Responsibilities: _allow shared parameter types_. **/
	private reference_allowed(type: string): boolean {
		if (this.tooling.tooling_type(type, this.language)) {
			return false;
		}
		if (this.project_types.count() === 0) {
			return true;
		}
		const names = this.type_names(type);
		return names.some((name) => !this.tooling.tooling_type(name, this.language));
	}

	/** Responsibilities: _argument usage count access_. **/
	private use_count(argument: AstTypedArgument, uses: ReadonlyMap<string, number>): number {
		const count = uses.get(argument.name);
		if (count === undefined) {
			return 0;
		}
		return count;
	}

	/** Responsibilities: _typed arguments classification_. **/
	private parameter_kind(argument: AstTypedArgument, type: string): ParameterKindResult {
		if (argument.kind === "basic") {
			return { supported: true, value: "basic" };
		}
		if ((argument.kind === "named" || argument.kind === "generic") && this.reference_allowed(type)) {
			return { supported: true, value: SHARED_PARAMETER_REFERENCE_KIND };
		}
		return { supported: false, value: "basic" };
	}

	/** Responsibilities: _derive parameter grouping identity_. **/
	private parameter_identity(argument: AstTypedArgument, type: string, kind: SharedParameterKind): string {
		if (kind === "basic") {
			return `${argument.name}:${type}`;
		}
		return type;
	}

	/** Responsibilities: _parameter record construction_. **/
	private parameter_result(
		argument: AstTypedArgument,
		type: string,
		kind: SharedParameterKind,
		uses: ReadonlyMap<string, number>,
	): AnalyzedParameter[] {
		const identity = this.parameter_identity(argument, type, kind);
		return [
			{
				key: JSON.stringify([kind, identity]),
				identity,
				kind,
				project_type: this.is_project_reference(kind, type),
				uses: this.use_count(argument, uses),
			},
		];
	}

	/** Responsibilities: _project parameter type classification_. **/
	private is_project_reference(kind: SharedParameterKind, type: string): boolean {
		if (kind !== SHARED_PARAMETER_REFERENCE_KIND) {
			return false;
		}
		return this.project_reference(type);
	}

	/** Responsibilities: _project type token classification_. **/
	private project_type_token(name: string): boolean {
		if (this.allowed_types.present(name)) {
			return false;
		}
		if (name.endsWith(CONTRACT_SUFFIX)) {
			return false;
		}
		return this.project_types.contains(this.aliased_token(name));
	}

	/** Responsibilities: _project type expression classification_. **/
	private project_type_expression(type: string): boolean {
		const names = this.type_names(type);
		const custom_names = names.filter((name) => !this.tooling.tooling_type(name, this.language));
		if (custom_names.length === 0) {
			return false;
		}
		if (this.project_types.contains(type)) {
			return true;
		}
		return custom_names.some((name) => this.project_type_token(name));
	}

	/** Responsibilities: _type context initialization_. **/
	public constructor(
		reference_aliases: readonly AstReferenceAlias[],
		project_types: ProjectTypeNameMembershipContract,
		language: SharedParameterLanguage = "unknown",
		allowed_types: StringNameMembershipContract,
	) {
		this.tooling = new SharedParameterTooling();
		this.project_types = project_types;
		this.allowed_types = allowed_types;
		this.aliases = new Map(reference_aliases.map((alias) => [alias.name, alias.target]));
		this.language = language;
	}

	/** Responsibilities: _type expression normalization_. **/
	public canonical(type: string): string {
		let result = "";
		let token = "";
		for (const character of type.trim()) {
			if (character.trim().length === 0) {
				continue;
			}
			if (!TYPE_SEPARATORS.includes(character)) {
				token += character;
				continue;
			}
			result = this.append_token(result, token) + character;
			token = "";
		}
		return this.append_token(result, token);
	}

	/** Responsibilities: _type references identification projection_. **/
	public project_reference(type: string): boolean {
		if (this.allowed_types.present(type)) {
			return false;
		}
		if (type.includes("ts.")) {
			return false;
		}
		return this.project_type_expression(type);
	}

	/** Responsibilities: _analyze shared parameter_. **/
	public parameter(argument: AstTypedArgument, uses: ReadonlyMap<string, number>): AnalyzedParameter[] {
		const type = this.canonical(argument.type);
		const kind = this.parameter_kind(argument, type);
		if (!kind.supported) {
			return [];
		}
		return this.parameter_result(argument, type, kind.value, uses);
	}
}
