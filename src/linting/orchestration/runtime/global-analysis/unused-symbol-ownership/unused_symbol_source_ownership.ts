import { TYPESCRIPT_CACHE_OWNER } from "src/constants";
import type { UnusedSymbolSourceOwnershipOptions } from "src/contracts/protocols/global_analysis_protocols";
import type {
	UnusedFieldOwnershipIndexContract,
	UnusedSymbolReceiverContract,
} from "src/contracts/protocols/lint_runtime_protocols";
import type { UnusedFieldOwner } from "src/core/types";
import type { UnusedSourceImportCache } from "src/core/types";
import type { ProjectSourceScanContract } from "src/source_protocols";
import type { LintSourceRecordData } from "src/source_types";
import ts from "typescript";

/** Responsibilities: _source import resolution_, _receiver field ownership_. **/
export class UnusedSymbolSourceOwnership {
	private readonly _source: LintSourceRecordData;
	private readonly _scanner: ProjectSourceScanContract;
	private readonly _available_files: Set<string>;
	private readonly _import_cache: UnusedSourceImportCache;
	private readonly _receiver: UnusedSymbolReceiverContract;
	private readonly _fields: UnusedFieldOwnershipIndexContract;

	/** Responsibilities: _class receiver field owners_. **/
	private this_field_owners(node: ts.Node): readonly UnusedFieldOwner[] {
		if (!ts.isClassDeclaration(node)) {
			return [];
		}
		if (node.name === undefined) {
			return [];
		}
		return this._fields
			.owner_fields(this._source.absolute_path, node.name.text, this.source_imports())
			.filter((item) => item.file === this._source.relative_path);
	}

	/** Responsibilities: _this receiver field owners_. **/
	private this_receiver_owners(ancestor: ts.Node): readonly UnusedFieldOwner[] {
		for (let current: ts.Node | undefined = ancestor; current !== undefined; current = current.parent) {
			const owners = this.this_field_owners(current);
			if (owners.length > 0) {
				return owners;
			}
		}
		return [];
	}

	/** Responsibilities: _source ownership initialization_. **/
	public constructor(options: UnusedSymbolSourceOwnershipOptions) {
		this._source = options.source;
		this._scanner = options.scanner;
		this._available_files = options.available_files;
		this._import_cache = options.import_cache;
		this._receiver = options.receiver;
		this._fields = options.fields;
	}

	/** Responsibilities: _source import targets_. **/
	public source_imports(): ReadonlySet<string> {
		const cached = this._import_cache.get(this._source.absolute_path);
		if (cached !== undefined) {
			return cached;
		}
		const resolved = this._scanner.imports(this._source.absolute_path, this._available_files).resolved_targets();
		this._import_cache.set(this._source.absolute_path, resolved);
		return resolved;
	}

	/** Responsibilities: _receiver property field owners_. **/
	public property_owners(receiver: ts.Expression): readonly UnusedFieldOwner[] {
		if (this._source.language !== TYPESCRIPT_CACHE_OWNER) {
			return [];
		}
		if (receiver.kind === ts.SyntaxKind.ThisKeyword) {
			return this.this_receiver_owners(receiver.parent);
		}
		const source_file = this._source.typescript_ast.source_file_node();
		if (!this._receiver.known(source_file, receiver)) {
			return [];
		}
		const owner = this._receiver.type(source_file, receiver);
		return this._fields.owner_fields(this._source.absolute_path, owner, this.source_imports());
	}
}
