import {
	PYTHON_ABSTRACT_MUTABLE_TYPES,
	PYTHON_ARRAY_MODULE_NAME,
	PYTHON_BUILTIN_MUTABLE_TYPES,
	PYTHON_BUILTINS_MODULE_NAME,
	PYTHON_COLLECTIONS_ABC_MODULE,
	PYTHON_COLLECTIONS_MUTABLE_TYPES,
	PYTHON_MUTABLE_COLLECTION_NAME_GROUPS,
	PYTHON_TYPING_MUTABLE_TYPES,
	PYTHON_TYPING_MODULE_NAME,
} from "src/linting/orchestration/runtime/python/constants";
import { PYTHON_COLLECTIONS_MODULE } from "src/constants";
import type { AstPythonImport, AstReferenceAlias } from "src/types";

/** Responsibilities: _mutable collection vocabulary_, _imported collection recognition_. **/
export class PythonMutableCollectionTypes {
	private readonly imports: readonly AstPythonImport[];
	private readonly type_alias_targets: ReadonlyMap<string, string>;

	/** Responsibilities: _mutable collection type name_. **/
	private type_name(type: string): string {
		const normalized = type.replace(/\s+/gu, "");
		const bracket = normalized.indexOf("[");
		let base = normalized;
		if (bracket >= 0) {
			base = normalized.slice(0, bracket);
		}
		const dot = base.lastIndexOf(".");
		return base.slice(dot + 1);
	}

	/** Responsibilities: _mutable type alias resolution_. **/
	private resolved_type_name(type: string): string {
		let name = this.type_name(type);
		const visited = new Set<string>();
		while (this.type_alias_targets.has(name) && !visited.has(name)) {
			visited.add(name);
			const target = this.type_alias_targets.get(name);
			if (target === undefined) {
				return name;
			}
			name = this.type_name(target);
		}
		return name;
	}

	/** Responsibilities: _imported collection module name_. **/
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

	/** Responsibilities: _imported mutable collection name_. **/
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

	/** Responsibilities: _mutable collection import index_. **/
	public constructor(imports: readonly AstPythonImport[], aliases: readonly AstReferenceAlias[]) {
		this.imports = imports;
		this.type_alias_targets = new Map(aliases.map((alias) => [alias.name, alias.target]));
	}

	/** Responsibilities: _known mutable collection type_. **/
	public known_mutable_type(type: string): boolean {
		const name = this.resolved_type_name(type);
		for (const group of PYTHON_MUTABLE_COLLECTION_NAME_GROUPS) {
			if (group.includes(name)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _imported mutable collection type_. **/
	public imported_mutable_type(type: string): boolean {
		const name = this.resolved_type_name(type);
		for (const imported_module of this.imports) {
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
