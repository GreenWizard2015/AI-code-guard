import { relative } from "node:path";
import { METRIC_KIND_FUNCTION } from "src/metrics/constants";
import type { AstCallableReference } from "src/model/ast/normalized_ast_types";
import type { ImportedSymbol } from "src/model_types";

/** Responsibilities: _Python reference mapping_, _imported target resolution_. **/
export class PythonCallableReferenceMapping {
	private readonly _project_root: string;
	private readonly _reference: AstCallableReference;
	private readonly _imports: ReadonlyMap<string, ImportedSymbol>;
	private readonly _source_class_names: ReadonlySet<string>;
	private readonly _empty_symbol: ImportedSymbol;

	/** Responsibilities: _imported Python callable name_. **/
	private imported_name(): string {
		if (this._reference.kind === METRIC_KIND_FUNCTION) {
			return this._reference.name;
		}
		const owner = this._reference.owner;
		if (owner.length === 0) {
			return "";
		}
		const caller_owner = this._reference.caller_owner;
		if (caller_owner.length > 0 && this._source_class_names.has(caller_owner)) {
			return "";
		}
		return owner;
	}

	/** Responsibilities: _Python reference mapping context_. **/
	public constructor(
		project_root: string,
		reference: AstCallableReference,
		imports: ReadonlyMap<string, ImportedSymbol>,
		source_class_names: ReadonlySet<string>,
	) {
		this._project_root = project_root;
		this._reference = reference;
		this._imports = imports;
		this._source_class_names = source_class_names;
		this._empty_symbol = { file: "", name: "" };
	}

	/** Responsibilities: _imported Python callable target_. **/
	public target(): ImportedSymbol {
		const name = this.imported_name();
		if (name.length === 0) {
			return this._empty_symbol;
		}
		const imported = this._imports.get(name);
		if (imported === undefined) {
			return this._empty_symbol;
		}
		if (this._reference.kind !== METRIC_KIND_FUNCTION && imported.file.length === 0) {
			return this._empty_symbol;
		}
		return imported;
	}

	/** Responsibilities: _Python reference mapping result_. **/
	public map(): AstCallableReference {
		let normalized = this._reference;
		if (typeof this._reference.target_file !== "string") {
			normalized = { ...this._reference, target_file: "" };
		}
		const imported = this.target();
		if (imported.file.length === 0) {
			return normalized;
		}
		let name = imported.name;
		if (this._reference.kind === "method") {
			name = this._reference.name;
		}
		return {
			...normalized,
			name,
			target_file: relative(this._project_root, imported.file).replaceAll("\\", "/"),
		};
	}
}
