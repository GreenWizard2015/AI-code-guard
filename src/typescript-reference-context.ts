import { TypeScriptImportedInstanceAliases } from 'src/bridge/ts/parser/typescript-imported-instance-aliases';
import { TypeScriptReferenceOwnerHelpers } from 'src/typescript-reference-owner-helpers';
import type { PropertyOwnerCallbacks } from 'src/protocols';
import type { CallOwnerResolver } from 'src/model/protocols';
import ts from 'typescript';
import { TypeScriptInstanceAliasCollector } from 'src/parser/ts/typescript-instance-alias-collector';
import type { InstanceAliasResolvers } from 'src/types';
import { TypeScriptCallReturns } from 'src/model/typescript-call-returns';
import type { TypeScriptSourceResolver } from 'src/model/types';
import { TypeScriptInstanceIndex } from 'src/model/typescript-instance-index';
import { TypeScriptPropertyState } from 'src/model/typescript-property-state';
/** Responsibilities: _initialization TypeScript aliases property_. **/
export class TypeScriptReferenceContext implements InstanceAliasResolvers, PropertyOwnerCallbacks, CallOwnerResolver {
	private readonly source_file: ts.SourceFile;
	private readonly aliases = new Map<string, string>();
	private readonly instances: TypeScriptInstanceIndex;
	private readonly property_state: TypeScriptPropertyState;
	private readonly call_returns: TypeScriptCallReturns;
	private readonly instance_collector: TypeScriptInstanceAliasCollector;
	private readonly reference_owner_helpers: TypeScriptReferenceOwnerHelpers;

	/** Responsibilities: _initialization imported local instance_. **/
	private initialize_import_aliases(): void {
		for (const statement of this.source_file.statements) {
			if (!ts.isImportDeclaration(statement)) {
				continue;
			}
			const bindings = statement.importClause?.namedBindings;
			if (!bindings || !ts.isNamedImports(bindings)) {
				continue;
			}
			for (const element of bindings.elements) {
				let imported_name = element.name.text;
				if (element.propertyName !== undefined) {
					imported_name = element.propertyName.text;
				}
				this.aliases.set(element.name.text, imported_name);
			}
		}
	}

	/** Responsibilities: _initialization property callable ownership_. **/
	private initialize_reference_state(): void {
		this.call_returns.initialize();
		this.property_state.append_tree(this.source_file);
		this.instance_collector.collect_variables();
		this.instance_collector.collect_parameters();
	}

	/** Responsibilities: _initialization source AST reference-resolution_. **/
	public constructor(source_file: ts.SourceFile, ...resolvers: TypeScriptSourceResolver[]) {
		this.source_file = source_file;
		this.instances = new TypeScriptInstanceIndex(source_file);
		this.call_returns = new TypeScriptCallReturns(source_file, this.aliases, ...resolvers);
		this.reference_owner_helpers = new TypeScriptReferenceOwnerHelpers(
			this.aliases,
			this.instances,
			this
		);
		this.property_state = new TypeScriptPropertyState(
			this.aliases,
			this,
			this.instances
		);
		this.instance_collector = new TypeScriptInstanceAliasCollector(
			source_file,
			this.aliases,
			this.instances,
			this.property_state,
			this
		);
	}

	/** Responsibilities: _resolution callable owner represented_. **/
	public call_owner(expression: ts.Expression, current_owner: string = ''): string {
		if (ts.isIdentifier(expression)) {
			return this.call_returns.owner_for(expression.text);
		}
		if (!ts.isPropertyAccessExpression(expression)) {
			return '';
		}
		const owner = this.method_owner(expression, current_owner);
		if (!owner) {
			return '';
		}
		return this.call_returns.owner_for(expression.name.text, owner);
	}

	/** Responsibilities: _resolution owner type represented_. **/
	public property_owner(
		expression: ts.PropertyAccessExpression,
		current_owner: string = ''
	): string {
		let owner = '';
		if (current_owner !== undefined) {
			owner = current_owner;
		}
		return this.reference_owner_helpers.property_base_owner(expression.expression, owner);
	}

	/** Responsibilities: _initialization reference indexing source_. **/
	public initialize(): void {
		const imported_instance_aliases = new TypeScriptImportedInstanceAliases();

		this.initialize_import_aliases();
		this.initialize_reference_state();
		for (const [name, owner] of imported_instance_aliases.imported_instance_aliases(this.source_file)) {
			this.instances.add(name, owner);
		}
	}

	/** Responsibilities: _resolution function name through_. **/
	public function_name(expression: ts.Identifier): string {
		const alias = this.aliases.get(expression.text);
		if (alias !== undefined) {
			return alias;
		}
		return expression.text;
	}

	/** Responsibilities: _resolution owner type method_. **/
	public method_owner(
		expression: ts.PropertyAccessExpression,
		current_owner: string = ''
	): string {
		let owner_name = '';
		if (current_owner !== undefined) {
			owner_name = current_owner;
		}
		const base_owner = this.reference_owner_helpers.property_base_owner(
			expression.expression,
			owner_name
		);
		if (!base_owner) {
			return '';
		}
		const owner = this.property_state.owner_for(base_owner, expression.name.text);
		if (!owner) {
			return base_owner;
		}
		return owner;
	}
}
