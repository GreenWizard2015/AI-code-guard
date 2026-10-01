import { PythonAstData } from "src/bridge/ts/core/python-ast-parser";
import type ts from "typescript";

import type { Violation } from "src/protocols";
import type { AstModuleInstance, NormalizedAstFile } from "src/types";
import { BUILTIN_CONSTRUCTORS } from "src/bridge/ts/runner/orchestration/runtime/constants";
import { TypeScriptSingletonCollector } from "src/bridge/ts/runner/orchestration/runtime/typescript-singleton/collector";
import { PythonClassVariableSingletons } from "src/bridge/ts/runner/orchestration/runtime/python-class-variable-singletons";
import { DiagnosticRule } from "src/model/diagnostic-rule";

/** Responsibilities: _detection singleton instances inspection_. **/
export class SingletonCollector {
	private readonly normalized_ast: NormalizedAstFile;

	private readonly local_class_names: ReadonlySet<string>;

	private readonly file: string;

	private readonly text: string;

	private readonly python_ast_parser = new PythonAstData();

	private readonly typescript: TypeScriptSingletonCollector;

	private readonly class_variable_singletons: PythonClassVariableSingletons;

	/** Responsibilities: _Python module instances collection_. **/
	private python_instances(): AstModuleInstance[] {
		let ast = this.normalized_ast;
		if (!ast) {
			ast = this.python_ast_parser.source_ast(this.text);
		}
		if (!ast.module_instances) {
			return [];
		}
		const project_class_names = new Set([...this.local_class_names, ...this.imported_class_names()]);
		const imported_module_names = this.imported_module_names();
		return ast.module_instances
			.filter((instance) => this.project_class_instance(instance, project_class_names, imported_module_names))
			.filter((instance) => !BUILTIN_CONSTRUCTORS.has(instance.constructor));
	}

	/** Responsibilities: _Python imported classes collection_. **/
	private imported_class_names(): ReadonlySet<string> {
		const names = new Set<string>();
		for (const import_node of this.normalized_ast.python_imports) {
			for (const imported of import_node.names) {
				if (!/^[A-Z]\w*$/u.test(imported.name)) {
					continue;
				}
				let name = imported.name;
				if (imported.alias !== undefined) {
					name = imported.alias;
				}
				names.add(name);
			}
		}
		return names;
	}

	/** Responsibilities: _Python imported modules collection_. **/
	private imported_module_names(): ReadonlySet<string> {
		const names = new Set<string>();
		for (const import_node of this.normalized_ast.python_imports) {
			for (const imported of import_node.names) {
				let name = imported.name;
				if (imported.alias !== undefined) {
					name = imported.alias;
				}
				if (import_node.module === imported.name) {
					names.add(name);
					continue;
				}
				if (!/^[A-Z]\w*$/u.test(imported.name)) {
					names.add(name);
				}
			}
		}
		return names;
	}

	/** Responsibilities: _Python class instance identification_. **/
	private project_class_instance(
		instance: AstModuleInstance,
		class_names: ReadonlySet<string>,
		module_names: ReadonlySet<string>,
	): boolean {
		if (class_names.has(instance.constructor)) {
			return true;
		}
		const separator = instance.constructor.lastIndexOf(".");
		if (separator < 0) {
			return false;
		}
		const module_name = instance.constructor.slice(0, separator);
		if (!module_names.has(module_name)) {
			return false;
		}
		const class_name = instance.constructor.slice(separator + 1);
		return /^[A-Z]\w*$/u.test(class_name);
	}

	/** Responsibilities: _Python singleton violations construction_. **/
	private python_violations(instances: AstModuleInstance[]): Violation[] {
		const violations: Violation[] = [];
		for (const instance of instances) {
			const rule = new DiagnosticRule("singleton");
			violations.push(rule.violation(this.file, instance.line + 1));
		}
		return violations;
	}

	/** Responsibilities: _singleton analysis state initialization_. **/
	constructor(
		file: string,
		text: string,
		local_class_names: ReadonlySet<string>,
		normalized_ast: NormalizedAstFile,
		source_file: ts.SourceFile,
	) {
		this.file = file;
		this.text = text;
		this.normalized_ast = normalized_ast;
		this.local_class_names = local_class_names;
		this.typescript = new TypeScriptSingletonCollector(file, source_file, local_class_names);
		this.class_variable_singletons = new PythonClassVariableSingletons(file, normalized_ast);
	}

	/** Responsibilities: _collection singleton violations language_. **/
	public collect_python(): Violation[] {
		const instances = this.python_instances();
		const module_violations = this.python_violations(instances);
		const class_violations = this.class_variable_singletons.violations();
		return [...module_violations, ...class_violations];
	}

	/** Responsibilities: _language singleton violations collection_. **/
	public collect_violations(python: boolean): Violation[] {
		if (python) {
			return this.collect_python();
		}
		return this.typescript.collect();
	}
}
