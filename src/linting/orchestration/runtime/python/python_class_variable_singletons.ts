import { PYTHON_CLASSVAR_NAME } from "src/constants";
import type {
	AstClassField,
	AstReferenceAlias,
	NormalizedAstFile,
	NormalizedAstSource,
} from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { PythonClassVariableSingletonsContract } from "src/python_protocols";
import type { ViolationContract } from "src/reporting_protocols";

/** Responsibilities: _class variable resolution_, _singleton diagnostics_. **/
export class PythonClassVariableSingletons implements PythonClassVariableSingletonsContract {
	private readonly _file: string;
	private readonly _declarations: NormalizedAstSource;
	private readonly _reference_aliases: AstReferenceAlias[];
	private readonly _alias_names: Set<string>;

	/** Responsibilities: _ClassVar imported alias collection_. **/
	private imported_aliases(): void {
		for (const import_node of this._declarations.python_imports) {
			if (!["typing", "typing_extensions"].includes(import_node.module)) {
				continue;
			}
			for (const imported of import_node.names) {
				if (imported.name !== PYTHON_CLASSVAR_NAME && imported.name !== import_node.module) {
					continue;
				}
				let name = imported.name;
				if (imported.alias.length > 0) {
					name = imported.alias;
				}
				this._alias_names.add(name);
			}
		}
	}

	/** Responsibilities: _ClassVar alias propagation_. **/
	private append_aliases(): void {
		const aliases = new Map<string, string>();
		for (const alias of this._reference_aliases) {
			aliases.set(alias.name, alias.target);
		}
		let changed = true;
		while (changed) {
			changed = this.append_alias_pass(aliases);
		}
	}

	/** Responsibilities: _one-pass ClassVar alias propagation_. **/
	private append_alias_pass(aliases: ReadonlyMap<string, string>): boolean {
		let changed = false;
		for (const [name, target] of aliases) {
			const resolved = this.class_alias_target(target);
			if (!this._alias_names.has(resolved)) {
				continue;
			}
			if (this._alias_names.has(name)) {
				continue;
			}
			this._alias_names.add(name);
			changed = true;
		}
		return changed;
	}

	/** Responsibilities: _ClassVar alias target resolution_. **/
	private class_alias_target(target: string): string {
		const separator = target.lastIndexOf(".");
		if (separator < 0) {
			return target;
		}
		return target.slice(separator + 1);
	}

	/** Responsibilities: _ClassVar annotation name resolution_. **/
	private annotation_name(annotation: string): string {
		const normalized = annotation.replaceAll(" ", "").replaceAll("'", "").replaceAll('"', "");
		const generic_start = normalized.indexOf("[");
		let name = normalized;
		if (generic_start >= 0) {
			name = normalized.slice(0, generic_start);
		}
		const namespace_separator = name.lastIndexOf(".");
		if (namespace_separator >= 0) {
			name = name.slice(namespace_separator + 1);
		}
		return name;
	}

	/** Responsibilities: _ClassVar field identification_. **/
	private is_class_variable(field: AstClassField, names: ReadonlySet<string>): boolean {
		if (field.class_variable) {
			return true;
		}
		if (typeof field.type !== "string") {
			return false;
		}
		return names.has(this.annotation_name(field.type));
	}

	/** Responsibilities: _Python class-variable singleton initialization_. **/
	public constructor(file: string, normalized_ast: NormalizedAstFile) {
		this._file = file;
		this._declarations = normalized_ast.source;
		this._reference_aliases = normalized_ast.references.reference_aliases;
		this._alias_names = new Set<string>([PYTHON_CLASSVAR_NAME]);
	}

	/** Responsibilities: _ClassVar annotation aliases_. **/
	public aliases(): ReadonlySet<string> {
		this.imported_aliases();
		this.append_aliases();
		return new Set(this._alias_names);
	}

	/** Responsibilities: _Python class-variable singleton violations_. **/
	public violations(): ViolationContract[] {
		const rule = new DiagnosticRule("singleton");
		const names = this.aliases();
		const violations: ViolationContract[] = [];
		for (const node of this._declarations.classes) {
			for (const field of node.field_analysis.fields) {
				if (this.is_class_variable(field, names)) {
					violations.push(rule.violation(this._file, field.line + 1));
				}
			}
		}
		return violations;
	}
}
