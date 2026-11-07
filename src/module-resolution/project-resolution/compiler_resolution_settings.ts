import type { TypeScriptPathMapping } from "src/module-resolution/types";
import ts from "typescript";

/** Responsibilities: _compiler path mapping_, _active package conditions_. **/
export class CompilerResolutionSettings {
	private readonly _options: ts.CompilerOptions;
	private readonly _paths_base: string;

	/** Responsibilities: _Node module mode_. **/
	private node_mode(): boolean {
		switch (this._options.moduleResolution) {
			case ts.ModuleResolutionKind.Node16:
			case ts.ModuleResolutionKind.NodeNext:
				return true;
			default:
				return false;
		}
	}

	/** Responsibilities: _compiler settings_. **/
	public constructor(options: ts.CompilerOptions, paths_base: string) {
		this._options = options;
		this._paths_base = paths_base;
	}

	/** Responsibilities: _project path mappings_. **/
	public path_mappings(): TypeScriptPathMapping[] {
		const paths: TypeScriptPathMapping[] = [];
		if (this._options.paths === undefined) {
			return paths;
		}
		for (const [pattern, targets] of Object.entries(this._options.paths)) {
			paths.push({ pattern, targets, base_path: this._paths_base });
		}
		return paths;
	}

	/** Responsibilities: _active package conditions_. **/
	public package_conditions(resolution_mode: string): string[] {
		const conditions = new Set([...(this._options.customConditions ?? []), "types"]);
		if (this.node_mode()) {
			conditions.add("node");
		}
		conditions.add(resolution_mode);
		conditions.add("default");
		return [...conditions];
	}
}
