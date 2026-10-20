import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { AstClassField, NormalizedAstFile } from "src/types";
import type { PythonClassVariableSingletonsContract } from "src/python_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import { PYTHON_CLASSVAR_NAME } from "src/constants";

/** Responsibilities: _class variable resolution_, _singleton diagnostics_. **/
export class PythonClassVariableSingletons implements PythonClassVariableSingletonsContract {
	private readonly file: string;
	private readonly normalized_ast: NormalizedAstFile;

	/** Responsibilities: _ClassVar imported alias collection_. **/
	private imported_aliases(names: Set<string>): void {
		for (const import_node of this.normalized_ast.python_imports) {
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
				names.add(name);
			}
		}
	}

	/** Responsibilities: _ClassVar alias propagation_. **/
	private append_aliases(names: Set<string>): void {
		const aliases = new Map(this.normalized_ast.reference_aliases.map((alias) => [alias.name, alias.target]));
		let changed = true;
		while (changed) {
			changed = false;
			for (const [name, target] of aliases) {
				const resolved = this.class_alias_target(target);
				if (!names.has(resolved)) {
					continue;
				}
				if (names.has(name)) {
					continue;
				}
				names.add(name);
				changed = true;
			}
		}
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
		this.file = file;
		this.normalized_ast = normalized_ast;
	}

	/** Responsibilities: _ClassVar annotation aliases_. **/
	public aliases(): ReadonlySet<string> {
		const names = new Set<string>([PYTHON_CLASSVAR_NAME]);
		this.imported_aliases(names);
		this.append_aliases(names);
		return names;
	}

	/** Responsibilities: _Python class-variable singleton violations_. **/
	public violations(): ViolationContract[] {
		const rule = new DiagnosticRule("singleton");
		const names = this.aliases();
		return this.normalized_ast.classes.flatMap((node) =>
			node.fields
				.filter((field) => this.is_class_variable(field, names))
				.map((field) => rule.violation(this.file, field.line + 1)),
		);
	}
}
