import { relative } from "node:path";
import { basename } from "node:path";
import { MAX_DIRECTORY_CLASSES, MAX_PER_DIRECTORY, MIN_DIRECTORY_CLASSES, MIN_PER_DIRECTORY } from "src/constants";
import type { IOContract } from "src/io/protocols";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { DirectoryViolationContext } from "src/model/types/types";
import type { DirectoryFileSet } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import { DIRECTORY_RULE_IDS } from "src/rules/constants";
import { DirectoryFacadeRules } from "src/rules/support/directory_facade_rules";
import { DirectoryFileCatalog } from "src/rules/support/directory_file_catalog";
import { DirectorySourceStructure } from "src/rules/support/directory_source_structure";
import type { AstClassNode, NormalizedAstFile } from "src/types";

/** Responsibilities: _directory source classification_, _directory size diagnostics_. **/
export class DirectoryStructureRules {
	private readonly minimum_files = MIN_PER_DIRECTORY;
	private readonly maximum_files = MAX_PER_DIRECTORY;
	private readonly file_catalog: DirectoryFileCatalog;
	private readonly facade_rules: DirectoryFacadeRules;
	private readonly source_structure: DirectorySourceStructure;

	/** Responsibilities: _direct source file count_. **/
	/** Responsibilities: _selection directory-size rule file_. **/
	private directory_rule(file_count: number): string {
		if (file_count === 0) {
			return "";
		}
		if (file_count < this.minimum_files) {
			return DIRECTORY_RULE_IDS.minimum;
		}
		if (file_count > this.maximum_files) {
			return DIRECTORY_RULE_IDS.maximum;
		}
		return "";
	}

	/** Responsibilities: _aggregation class counts direct_. **/
	private implementation_class_count(classes: readonly AstClassNode[]): number {
		let count = 0;
		for (const class_node of classes) {
			let is_contract = class_node.protocol;
			if (class_node.type_contract) {
				is_contract = true;
			}
			if (is_contract) {
				continue;
			}
			count += 1;
		}
		return count;
	}

	/** Responsibilities: _aggregation class counts direct_. **/
	private class_count(files: readonly string[], class_counts: ReadonlyMap<string, readonly AstClassNode[]>): number {
		let count = 0;
		for (const file of files) {
			const is_special_file = this.file_catalog.special_file_names.has(basename(file));
			if (is_special_file) {
				continue;
			}
			const current_classes = class_counts.get(file);
			if (current_classes === undefined) {
				continue;
			}
			count += this.implementation_class_count(current_classes);
		}
		return count;
	}

	/** Responsibilities: _selection directory-class rule class_. **/
	private class_rule(class_count: number): string {
		if (class_count > MAX_DIRECTORY_CLASSES) {
			return DIRECTORY_RULE_IDS.class_maximum;
		}
		if (class_count > 0 && class_count < MIN_DIRECTORY_CLASSES) {
			return DIRECTORY_RULE_IDS.class_minimum;
		}
		return "";
	}

	/** Responsibilities: _directory class violation deferral_. **/
	private defer_class_violation(directory: string, class_count: number): boolean {
		if (class_count <= 0) {
			return false;
		}
		if (class_count >= MIN_DIRECTORY_CLASSES) {
			return false;
		}
		return this.file_catalog.child_directory_files(directory);
	}

	/** Responsibilities: _creation directory class-count violation_. **/
	private directory_class_violation(
		directory: string,
		repo_root: string,
		source_files: readonly string[],
		class_counts: ReadonlyMap<string, readonly AstClassNode[]>,
	): ViolationContract[] {
		if (source_files.length === 0) {
			return [];
		}
		const class_count = this.class_count(source_files, class_counts);
		if (this.defer_class_violation(directory, class_count)) {
			return [];
		}
		const rule_id = this.class_rule(class_count);
		if (rule_id.length === 0) {
			return [];
		}
		const rule = new DiagnosticRule(rule_id);
		return [
			rule.violation(relative(repo_root, directory), 1, {
				count: String(class_count),
			}),
		];
	}

	/** Responsibilities: _aggregation file-count class-count violations_. **/
	private append_directory(
		violations: ViolationContract[],
		directory: string,
		context: DirectoryViolationContext,
	): void {
		const source_files = context.directory_sources.get(directory);
		if (source_files !== undefined) {
			violations.push(...this.directory_violation(directory, context.repo_root));
			violations.push(
				...this.directory_class_violation(directory, context.repo_root, source_files, context.class_counts),
			);
			violations.push(...this.facade_rules.facade_violations(context.repo_root, source_files, context.source_asts));
		}
		violations.push(
			...this.source_structure.source_subdirectory_violation(
				directory,
				context.repo_root,
				context.directory_sources.keys(),
			),
		);
	}

	/** Responsibilities: _collection structure violations directory_. **/
	/** Responsibilities: _field initialization_. **/
	constructor(directory_files: DirectoryFileSet, file_io: IOContract) {
		this.file_catalog = new DirectoryFileCatalog(directory_files, file_io);
		this.facade_rules = new DirectoryFacadeRules();
		this.source_structure = new DirectorySourceStructure();
	}
	/** Responsibilities: _public operation_. **/
	public directory_violation(directory: string, repo_root: string): ViolationContract[] {
		const file_count = this.file_catalog.direct_file_count(directory);
		const rule_id = this.directory_rule(file_count);
		if (rule_id.length === 0) {
			return [];
		}
		const rule = new DiagnosticRule(rule_id);
		return [
			rule.violation(relative(repo_root, directory), 1, {
				count: String(file_count),
			}),
		];
	}

	/** Responsibilities: _aggregation structure violations directories_. **/
	public append_directory_violations(
		violations: ViolationContract[],
		files: string[],
		repo_root: string,
		class_counts: ReadonlyMap<string, readonly AstClassNode[]>,
		source_asts: ReadonlyMap<string, NormalizedAstFile>,
	): void {
		const directory_sources = this.source_structure.source_directories(files);
		const context: DirectoryViolationContext = {
			directory_sources,
			repo_root,
			class_counts,
			source_asts,
		};
		for (const directory of this.source_structure.directories_to_check(directory_sources.keys(), repo_root)) {
			this.append_directory(violations, directory, context);
		}
	}
}
