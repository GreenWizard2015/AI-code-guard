import { TestPathSyntax } from 'src/test-path-syntax';
import { relative } from 'node:path';
import type { Violation } from 'src/protocols';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import { ProjectSourceScanner } from 'src/bridge/ts/project-source-scanner';
import type { ReferenceData } from 'src/bridge/ts/core/types';
import type { ProjectSourceOptions } from 'src/bridge/ts/runner/types';

/** Responsibilities: _detection unresolved imports unused_. **/
export class UnusedCode {
	private readonly missing_import_rule = new DiagnosticRule('missing-import');
	private readonly unused_file_rule = new DiagnosticRule('unused-file');

	/** Responsibilities: _creation violations unresolved project_. **/
	private unresolved_import_violations(
		root: string,
		scanner: ProjectSourceScanner,
		available: Set<string>,
		importer: string
	): Violation[] {
		const file = relative(root, importer).split('\\').join('/');
		const specifiers = scanner.unresolved_relative_imports(importer, available);
		if (specifiers.length === 0) {
			return [];
		}
		return specifiers.map(specifier => this.missing_import_rule.violation(file, 0, { specifier }));
	}

	/** Responsibilities: _collection source imports resolution_. **/
	private reference_data(
		files: string[],
		importer_data: (file: string) => ReferenceData
	): ReferenceData {
		const referenced = new Set<string>();
		const unresolved: Violation[] = [];
		for (const importer of files) {
			const data = importer_data(importer);
			unresolved.push(...data.unresolved);
			for (const imported of data.referenced) {
				referenced.add(imported);
			}
		}
		return { referenced, unresolved };
	}

	/** Responsibilities: _creation violations files project_. **/
	private unused_file_violations(
		root: string,
		entry: (file: string) => boolean,
		files: string[],
		referenced: Set<string>
	): Violation[] {
		const test_path_syntax = new TestPathSyntax();

		const candidates = files.filter(
			file => (!entry(file)) && (!test_path_syntax.test_file(relative(root, file))) && (!referenced.has(file))
		);
		if (candidates.length === 0) {
			return [];
		}
		return candidates.map(file =>
			this.unused_file_rule.violation(relative(root, file).split('\\').join('/'), 0)
		);
	}

	/** Responsibilities: _collection importer data discovered_. **/
	private importer_reference_data(
		root: string,
		scanner: ProjectSourceScanner,
		available: Set<string>,
		importer: string
	): ReferenceData {
		const unresolved = this.unresolved_import_violations(root, scanner, available, importer);
		const referenced = scanner.resolved_imports(importer, available);
		return { referenced, unresolved };
	}

	/** Responsibilities: _collection unused unresolved-import violations_. **/
	public collect_scanner_violations(
		root: string,
		scanner: ProjectSourceScanner,
		files: string[],
	): Violation[] {
		const available = new Set(files);
		const importer_data = (file: string): ReferenceData =>
			this.importer_reference_data(root, scanner, available, file);
		const { referenced, unresolved } = this.reference_data(files, importer_data);
		return [
			...unresolved,
			...this.unused_file_violations(root, file => scanner.entry(file), files, referenced),
		];
	}

	/** Responsibilities: _reporting unused scanning projection_. **/
	public collect_unused_files(root: string, options: ProjectSourceOptions): Violation[] {
		const scanner = new ProjectSourceScanner(root, options);
		const files = scanner.files();
		return this.collect_scanner_violations(root, scanner, files);
	}
}
