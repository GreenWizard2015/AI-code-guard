import { basename, extname } from "node:path";
import { PYTHON_INDEX_MODULE, TYPESCRIPT_INDEX_MODULE } from "src/constants";
import { PYTHON_PACKAGE_MARKER } from "src/constants";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { FileNameRulesContract, TestPathSyntaxContract } from "src/shared_services_protocols";
import { TestPathKind } from "src/types";

import type { AstClassNode } from "src/model/ast/normalized_ast_types";

/** Responsibilities: _source file naming rules_, _filename diagnostics_. **/
export class FileNameRules implements FileNameRulesContract {
	private readonly _class_rule: RuleContract;
	private readonly _numeric_rule: RuleContract;
	private readonly _test_path_syntax: TestPathSyntaxContract;

	/** Responsibilities: _file eligibility classification_. **/
	private excluded_file(candidate_file: string): boolean {
		if (this._test_path_syntax.classify(candidate_file).has(TestPathKind.TestFile)) {
			return true;
		}
		const name = basename(candidate_file);
		return name === TYPESCRIPT_INDEX_MODULE || name === PYTHON_INDEX_MODULE || name === PYTHON_PACKAGE_MARKER;
	}

	/** Responsibilities: _single-class file-name violation construction_. **/
	private append_class_violation(
		class_violations: ViolationContract[],
		source_file: string,
		class_node: AstClassNode,
	): void {
		const actual_name = basename(source_file);
		const expected_name = this.expected_file_name(class_node.identity.name, source_file);
		if (actual_name === expected_name) {
			return;
		}
		class_violations.push(this._class_rule.violation(source_file, class_node.identity.start + 1, { expected_name }));
	}

	/** Responsibilities: _single-class file-name rule initialization_. **/
	public constructor(test_path_syntax: TestPathSyntaxContract) {
		this._class_rule = new DiagnosticRule("single-class-file-name");
		this._numeric_rule = new DiagnosticRule("numeric-file-name");
		this._test_path_syntax = test_path_syntax;
	}

	/** Responsibilities: _numeric file-name diagnostics_. **/
	public append_numeric(violations: ViolationContract[], file: string): void {
		const name = basename(file).replace(/\.d\.(?:ts|mts|cts)$|\.(?:ts|tsx|mts|cts|py)$/u, "");
		const numbers = name.match(/\d+/gu);
		let valid_name = numbers === null;
		if (!valid_name && numbers !== null) {
			valid_name = numbers.every((number) => {
				const value = BigInt(number);
				return value >= 16n && (value & (value - 1n)) === 0n;
			});
		}
		if (valid_name) {
			return;
		}
		violations.push(this._numeric_rule.violation(file, 1, {}));
	}

	/** Responsibilities: _single-class file-name violation addition_. **/
	public append(violations: ViolationContract[], analysis_file: string, classes: readonly AstClassNode[]): void {
		if (classes.length === 1 && !this.excluded_file(analysis_file)) {
			const class_node = classes.find((node) => !node.classification.protocol && !node.classification.type_contract);
			if (class_node !== undefined) {
				this.append_class_violation(violations, analysis_file, class_node);
			}
		}
	}

	/** Responsibilities: _class name file-name conversion_. **/
	public expected_file_name(class_name: string, source_path: string): string {
		const separated = class_name.replace(/([A-Z]+)([A-Z][a-z])/gu, "$1_$2").replace(/([a-z0-9])([A-Z])/gu, "$1_$2");
		const words = separated.split(/[_\s-]+/u).filter((word) => word.length > 0);
		let extension = extname(source_path);
		if (/\.d\.(?:ts|mts|cts)$/u.test(source_path)) {
			extension = source_path.slice(source_path.lastIndexOf(".d."));
		}
		return `${words.join("_").toLowerCase()}${extension}`;
	}
}
