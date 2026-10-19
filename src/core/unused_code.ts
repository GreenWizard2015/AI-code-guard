import { TestPathSyntax } from "src/test_path_syntax";
import { relative } from "node:path";
import type { ProjectSourceScannerContract, ViolationContract } from "src/protocols";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { ProjectSourceScanner } from "src/core/project-source/project_source_scanner";
import type { ProjectSourceOptions } from "src/model/types/types";

/** Responsibilities: _unresolved import detection_, _unused file analysis_. **/
export class UnusedCode {
	private readonly missing_import_rule: DiagnosticRule;
	private readonly unused_file_rule: DiagnosticRule;

	/** Responsibilities: _creation violations unresolved project_. **/
	private unresolved_import_violations(
		root: string,
		scanner: ProjectSourceScannerContract,
		available: Set<string>,
		importer: string,
	): ViolationContract[] {
		const file = relative(root, importer).split("\\").join("/");
		const specifiers = scanner.unresolved_relative_imports(importer, available);
		if (specifiers.length === 0) {
			return [];
		}
		return specifiers.map((specifier) => this.missing_import_rule.violation(file, 0, { specifier }));
	}

	/** Responsibilities: _dependency path traversal_. **/
	private reachable_files(scanner: ProjectSourceScannerContract, files: string[], available: Set<string>): Set<string> {
		const reachable = new Set<string>();
		const pending = files.filter((file) => scanner.entry(file));
		while (pending.length > 0) {
			const file = pending.pop();
			if (file === undefined || reachable.has(file)) {
				continue;
			}
			reachable.add(file);
			for (const imported of scanner.resolved_imports(file, available)) {
				if (available.has(imported) && !reachable.has(imported)) {
					pending.push(imported);
				}
			}
		}
		return reachable;
	}

	/** Responsibilities: _creation violations files project_. **/
	private unused_file_violations(
		root: string,
		scanner: ProjectSourceScannerContract,
		files: string[],
	): ViolationContract[] {
		const test_path_syntax = new TestPathSyntax();
		const available = new Set(files);
		const reachable = this.reachable_files(scanner, files, available);

		const candidates = files.filter((file) => {
			if (test_path_syntax.test_file(relative(root, file))) {
				return false;
			}
			return !reachable.has(file);
		});
		if (candidates.length === 0) {
			return [];
		}
		return candidates.map((file) => this.unused_file_rule.violation(relative(root, file).split("\\").join("/"), 0));
	}

	/** Responsibilities: _collection unused unresolved-import violations_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.missing_import_rule = new DiagnosticRule("missing-import");
		this.unused_file_rule = new DiagnosticRule("unused-file");
	}
	/** Responsibilities: _public operation_. **/
	public collect_scanner_violations(
		root: string,
		scanner: ProjectSourceScannerContract,
		files: string[],
	): ViolationContract[] {
		const available = new Set(files);
		const unresolved = files.flatMap((file) => this.unresolved_import_violations(root, scanner, available, file));
		return [...unresolved, ...this.unused_file_violations(root, scanner, files)];
	}

	/** Responsibilities: _reporting unused scanning projection_. **/
	public collect_unused_files(root: string, options: ProjectSourceOptions): ViolationContract[] {
		const scanner = new ProjectSourceScanner(root, options);
		const files = scanner.files();
		return this.collect_scanner_violations(root, scanner, files);
	}
}
