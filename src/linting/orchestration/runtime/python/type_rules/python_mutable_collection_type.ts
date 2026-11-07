import { PYTHON_COLLECTIONS_MODULE } from "src/constants";
import {
	PYTHON_ABSTRACT_MUTABLE_TYPES,
	PYTHON_ARRAY_MODULE_NAME,
	PYTHON_BUILTINS_MODULE_NAME,
	PYTHON_BUILTIN_MUTABLE_TYPES,
	PYTHON_COLLECTIONS_ABC_MODULE,
	PYTHON_COLLECTIONS_MUTABLE_TYPES,
	PYTHON_MUTABLE_COLLECTION_NAME_GROUPS,
	PYTHON_TYPING_MODULE_NAME,
	PYTHON_TYPING_MUTABLE_TYPES,
} from "src/linting/orchestration/runtime/python/constants";
import type { AstPythonImport } from "src/model/ast/normalized_ast_types";

/** Responsibilities: _mutable collection type_, _imported collection recognition_. **/
export class PythonMutableCollectionType {
	private readonly _source_type: string;
	private readonly _imports: readonly AstPythonImport[];
	private readonly _type_alias_targets: ReadonlyMap<string, string>;

	/** Responsibilities: _mutable collection type name_. **/
	private type_name(): string {
		const normalized = this._source_type.replace(/\s+/gu, "");
		const bracket = normalized.indexOf("[");
		let base = normalized;
		if (bracket >= 0) {
			base = normalized.slice(0, bracket);
		}
		const dot = base.lastIndexOf(".");
		return base.slice(dot + 1);
	}

	/** Responsibilities: _alias target type name_. **/
	private alias_target_name(alias_target: string): string {
		const normalized = alias_target.replace(/\s+/gu, "");
		const bracket = normalized.indexOf("[");
		let base = normalized;
		if (bracket >= 0) {
			base = normalized.slice(0, bracket);
		}
		return base.slice(base.lastIndexOf(".") + 1);
	}

	/** Responsibilities: _mutable type alias resolution_. **/
	private resolved_type_name(): string {
		let name = this.type_name();
		const visited = new Set<string>();
		while (this._type_alias_targets.has(name) && !visited.has(name)) {
			visited.add(name);
			const target = this._type_alias_targets.get(name);
			if (target === undefined) {
				return name;
			}
			name = this.alias_target_name(target);
		}
		return name;
	}

	/** Responsibilities: _mutable collection module matching_. **/
	private module_imports_type(module: string, name: string): boolean {
		if (module === PYTHON_COLLECTIONS_MODULE && PYTHON_COLLECTIONS_MUTABLE_TYPES.includes(name)) {
			return true;
		}
		if (module === PYTHON_COLLECTIONS_ABC_MODULE && PYTHON_ABSTRACT_MUTABLE_TYPES.includes(name)) {
			return true;
		}
		if (module === PYTHON_TYPING_MODULE_NAME) {
			return PYTHON_TYPING_MUTABLE_TYPES.includes(name) || PYTHON_ABSTRACT_MUTABLE_TYPES.includes(name);
		}
		if (module === PYTHON_BUILTINS_MODULE_NAME && PYTHON_BUILTIN_MUTABLE_TYPES.includes(name)) {
			return true;
		}
		return module === PYTHON_ARRAY_MODULE_NAME && name === PYTHON_ARRAY_MODULE_NAME;
	}

	/** Responsibilities: _imported mutable type matching_. **/
	private imported_name_matches(module: string, imported_name: string, alias: string, name: string): boolean {
		let local_name = imported_name;
		if (alias.length > 0) {
			local_name = alias;
		}
		if (local_name !== name) {
			return false;
		}
		return this.module_imports_type(module, imported_name);
	}

	/** Responsibilities: _mutable collection type initialization_. **/
	public constructor(
		source_type: string,
		imports: readonly AstPythonImport[],
		type_alias_targets: ReadonlyMap<string, string>,
	) {
		this._source_type = source_type;
		this._imports = imports;
		this._type_alias_targets = type_alias_targets;
	}

	/** Responsibilities: _standard mutable collection classification_. **/
	public known_mutable(): boolean {
		const name = this.resolved_type_name();
		for (const group of PYTHON_MUTABLE_COLLECTION_NAME_GROUPS) {
			if (group.includes(name)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _imported mutable collection classification_. **/
	public imported(): boolean {
		const name = this.resolved_type_name();
		for (const imported_module of this._imports) {
			if (imported_module.kind !== "from") {
				continue;
			}
			for (const imported_name of imported_module.names) {
				if (this.imported_name_matches(imported_module.module, imported_name.name, imported_name.alias, name)) {
					return true;
				}
			}
		}
		return false;
	}
}
