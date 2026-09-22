import type { AstReferenceAlias, AstTypedArgument } from 'src/types';
import type {
	AnalyzedParameter,
	SharedParameterKind,
	SharedParameterLanguage,
} from 'src/metrics/types';

import { TYPE_SEPARATORS } from 'src/metrics/constants';
import type { ParameterKindResult } from 'src/metrics/types';

/** Responsibilities: _shared parameter types classification_. **/
export class SharedParameterType {
	private readonly aliases: ReadonlyMap<string, string>;
	private readonly project_types: ReadonlySet<string>;
	private readonly language: SharedParameterLanguage;

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
		let current = '';
		for (const character of type) {
			if (!TYPE_SEPARATORS.includes(character)) {
				current += character;
				continue;
			}
			if (current.length > 0) {
				names.push(current);
				current = '';
			}
		}
		if (current.length > 0) {
			names.push(current);
		}
		return names;
	}

	/** Responsibilities: _excluded tooling types identification_. **/
	private tooling_type(type: string): boolean {
		if (this.language === 'typescript' && type.startsWith('Json')) {
			return true;
		}
		if (type.startsWith('ast.')) {
			return true;
		}
		if (type.startsWith('ts.')) {
			return true;
		}
		return type.length === 1 && type === type.toUpperCase();
	}

	/** Responsibilities: _allow shared parameter types_. **/
	private reference_allowed(type: string): boolean {
		if (this.tooling_type(type)) {
			return false;
		}
		if (this.project_types.size === 0) {
			return true;
		}
		return this.project_reference(type);
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
		if (argument.kind === 'basic') {
			return { supported: true, value: 'basic' };
		}
if ((argument.kind === 'named' || argument.kind === 'generic') && this.reference_allowed(type)) {
			return { supported: true, value: 'reference' };
		}
		return { supported: false, value: 'basic' };
	}

	/** Responsibilities: _derive parameter grouping identity_. **/
	private parameter_identity(argument: AstTypedArgument, type: string, kind: SharedParameterKind): string {
		if (kind === 'basic') {
			return `${argument.name}:${type}`;
		}
		return type;
	}

	/** Responsibilities: _parameter record construction_. **/
	private parameter_result(
		argument: AstTypedArgument,
		type: string,
		kind: SharedParameterKind,
		uses: ReadonlyMap<string, number>
	): AnalyzedParameter[] {
		const identity = this.parameter_identity(argument, type, kind);
		return [{
			key: JSON.stringify([kind, identity]),
			identity,
			kind,
			project_type: kind === 'reference' && this.project_reference(type),
			uses: this.use_count(argument, uses),
		}];
	}

	/** Responsibilities: _type context initialization_. **/
	public constructor(
		reference_aliases: readonly AstReferenceAlias[],
		project_types: ReadonlySet<string>,
		language: SharedParameterLanguage = 'unknown'
	) {
		this.project_types = project_types;
		this.aliases = new Map(reference_aliases.map(alias => [alias.name, alias.target]));
		this.language = language;
	}

	/** Responsibilities: _type expression normalization_. **/
	public canonical(type: string): string {
		let result = '';
		let token = '';
		for (const character of type.trim()) {
			if (character.trim().length === 0) {
				continue;
			}
			if (!TYPE_SEPARATORS.includes(character)) {
				token += character;
				continue;
			}
			result = this.append_token(result, token) + character;
			token = '';
		}
		return this.append_token(result, token);
	}

	/** Responsibilities: _type references identification projection_. **/
	public project_reference(type: string): boolean {
		if (this.project_types.has(type)) {
			return true;
		}
		return this.type_names(type).some(name => this.project_types.has(name));
	}

	/** Responsibilities: _analyze shared parameter_. **/
	public parameter(
		argument: AstTypedArgument,
		uses: ReadonlyMap<string, number>
	): AnalyzedParameter[] {
		const type = this.canonical(argument.type);
		const kind = this.parameter_kind(argument, type);
		if (!kind.supported) {
			return [];
		}
		return this.parameter_result(argument, type, kind.value, uses);
	}
}
