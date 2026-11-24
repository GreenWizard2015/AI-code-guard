import { TYPESCRIPT_CACHE_OWNER } from "src/constants";
import type {
	UnusedSymbolElementAccess,
	UnusedSymbolPropertyOwnershipContract,
	UnusedSymbolPropertyUsageIndexContract,
	UnusedSymbolUsageStoreContract,
} from "src/contracts/protocols/global_analysis_protocols";
import type { UnusedSymbolDefinition } from "src/core/types";
import { TypeScriptAstNodeObserverRegistry } from "src/model/type_script_ast_node_observer_registry";
import { TypeScriptAstDispatchPhase } from "src/parser/analysis/protocols";
import type { LintSourceRecordData } from "src/source_types";
import ts from "typescript";

/** Responsibilities: _property reference indexing_, _contract field usage lookup_, _unused field resolution_. **/
export class UnusedSymbolPropertyUsageIndex implements UnusedSymbolPropertyUsageIndexContract {
	private readonly _usage_store: UnusedSymbolUsageStoreContract;
	private readonly _ownership: UnusedSymbolPropertyOwnershipContract;
	private readonly _node_dispatcher: TypeScriptAstNodeObserverRegistry<LintSourceRecordData>;
	private readonly _contract_usage: Map<string, boolean>;

	/** Responsibilities: _field usage reference insertion_. **/
	private add_field_usage(source: LintSourceRecordData, receiver: ts.Expression, name: string): void {
		const owners = this._ownership.property_usage_owners(source, receiver, name);
		for (const owner of owners) {
			this._usage_store.record_field_usage({ owner, name });
		}
	}

	/** Responsibilities: _literal element access references_. **/
	private element_access_usage(input: UnusedSymbolElementAccess): void {
		const argument = input.access.argumentExpression;
		if (argument === undefined || !ts.isStringLiteral(argument)) {
			return;
		}
		this.add_field_usage(input.source, input.access.expression, argument.text);
	}

	/** Responsibilities: _property access dispatch_. **/
	private property_usage(record: LintSourceRecordData, access_candidate: ts.Node): void {
		if (ts.isPropertyAccessExpression(access_candidate)) {
			this.add_field_usage(record, access_candidate.expression, access_candidate.name.text);
			return;
		}
		if (ts.isElementAccessExpression(access_candidate)) {
			this.element_access_usage({ source: record, access: access_candidate });
		}
	}

	/** Responsibilities: _object property references_. **/
	private object_property_usage(record: LintSourceRecordData, property_candidate: ts.Node): void {
		if (!ts.isPropertyAssignment(property_candidate) && !ts.isShorthandPropertyAssignment(property_candidate)) {
			return;
		}
		if (!ts.isIdentifier(property_candidate.name) && !ts.isStringLiteral(property_candidate.name)) {
			return;
		}
		this.add_field_usage(record, property_candidate.parent, property_candidate.name.text);
	}

	/** Responsibilities: _contract field usage lookup_. **/
	private contract_usage_present(definition: UnusedSymbolDefinition): boolean {
		const cached = this._contract_usage.get(definition.name);
		if (cached !== undefined) {
			return cached;
		}
		let used = false;
		for (const owner of this._ownership.contract_fields(definition)) {
			if (this._usage_store.field_usage_present({ owner, name: definition.name })) {
				used = true;
				break;
			}
		}
		this._contract_usage.set(definition.name, used);
		return used;
	}

	/** Responsibilities: _property usage dependencies_. **/
	public constructor(usage_store: UnusedSymbolUsageStoreContract, ownership: UnusedSymbolPropertyOwnershipContract) {
		this._usage_store = usage_store;
		this._ownership = ownership;
		this._contract_usage = new Map<string, boolean>();
		this._node_dispatcher = new TypeScriptAstNodeObserverRegistry();
		this._node_dispatcher.register(
			TypeScriptAstDispatchPhase.ProjectIndex,
			[
				ts.SyntaxKind.PropertyAccessExpression,
				ts.SyntaxKind.ElementAccessExpression,
				ts.SyntaxKind.PropertyAssignment,
				ts.SyntaxKind.ShorthandPropertyAssignment,
			],
			({ node }, source) => {
				this.property_usage(source, node);
				this.object_property_usage(source, node);
			},
		);
	}

	/** Responsibilities: _TypeScript property traversal_. **/
	public add_source(source: LintSourceRecordData): void {
		if (source.language !== TYPESCRIPT_CACHE_OWNER) {
			return;
		}
		this._node_dispatcher.dispatch(
			TypeScriptAstDispatchPhase.ProjectIndex,
			source.traversal,
			source.typescript_ast.source_file_node(),
			source,
		);
	}

	/** Responsibilities: _field contract usage_. **/
	public usage_present(definition: UnusedSymbolDefinition): boolean {
		if (
			this._usage_store.field_usage_present({
				owner: { file: definition.file, owner: definition.owner },
				name: definition.name,
			})
		) {
			return true;
		}
		if (definition.owner_kind !== "class") {
			return false;
		}
		return this.contract_usage_present(definition);
	}
}
