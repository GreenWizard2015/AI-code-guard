import { TYPESCRIPT_CACHE_OWNER } from "src/constants";
import type {
	UnusedSymbolElementAccess,
	UnusedSymbolPropertyAccess,
	UnusedSymbolPropertyOwnershipContract,
} from "src/contracts/protocols/global_analysis_protocols";
import type { UnusedSymbolDefinition } from "src/core/types";
import { TypeScriptAstDispatchPhase } from "src/parser/analysis/protocols";
import { TypeScriptAstNodeObserverRegistry } from "src/parser/analysis/type_script_ast_node_observer_registry";
import type { SourceReferenceIndexContract } from "src/shared_services_protocols";
import type { LintSourceRecordData } from "src/source_types";
import ts from "typescript";

/** Responsibilities: _unused property usage_, _field contract references_. **/
export class UnusedSymbolPropertyUsageIndex {
	private readonly _references: SourceReferenceIndexContract<string>;
	private readonly _ownership: UnusedSymbolPropertyOwnershipContract;
	private readonly _node_dispatcher: TypeScriptAstNodeObserverRegistry<LintSourceRecordData>;

	/** Responsibilities: _field usage reference insertion_. **/
	private add_field_usage(source: LintSourceRecordData, receiver: ts.Expression, name: string, line: number): void {
		const owners = this._ownership.property_usage_owners(source, receiver, name);
		for (const owner of owners) {
			this._references.add_usage_once(
				`field\u0000${owner.file}\u0000${owner.owner}\u0000${name}`,
				source.relative_path,
				line,
			);
		}
	}

	/** Responsibilities: _property access references_. **/
	private property_access_usage(input: UnusedSymbolPropertyAccess): void {
		const source_file = input.source.typescript_ast.source_file_node();
		const line = source_file.getLineAndCharacterOfPosition(input.access.name.getStart(source_file)).line + 1;
		this.add_field_usage(input.source, input.access.expression, input.access.name.text, line);
	}

	/** Responsibilities: _literal element access references_. **/
	private element_access_usage(input: UnusedSymbolElementAccess): void {
		const argument = input.access.argumentExpression;
		if (argument === undefined || !ts.isStringLiteral(argument)) {
			return;
		}
		const source_file = input.source.typescript_ast.source_file_node();
		const line = source_file.getLineAndCharacterOfPosition(argument.getStart(source_file)).line + 1;
		this.add_field_usage(input.source, input.access.expression, argument.text, line);
	}

	/** Responsibilities: _property access dispatch_. **/
	private property_usage(record: LintSourceRecordData, access_candidate: ts.Node): void {
		if (ts.isPropertyAccessExpression(access_candidate)) {
			this.property_access_usage({ source: record, access: access_candidate });
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
		const source_file = record.typescript_ast.source_file_node();
		const line = source_file.getLineAndCharacterOfPosition(property_candidate.name.getStart(source_file)).line + 1;
		this.add_field_usage(record, property_candidate.parent, property_candidate.name.text, line);
	}

	/** Responsibilities: _property usage dependencies_. **/
	public constructor(
		references: SourceReferenceIndexContract<string>,
		ownership: UnusedSymbolPropertyOwnershipContract,
	) {
		this._references = references;
		this._ownership = ownership;
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
		const field_key = `field\u0000${definition.file}\u0000${definition.owner}\u0000${definition.name}`;
		if (this._references.references_for(field_key, "usage").length > 0) {
			return true;
		}
		for (const owner of this._ownership.contract_fields(definition)) {
			const key = `field\u0000${owner.file}\u0000${owner.owner}\u0000${definition.name}`;
			if (this._references.references_for(key, "usage").length > 0) {
				return true;
			}
		}
		return false;
	}
}
