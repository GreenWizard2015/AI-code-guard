import { basename, extname } from "node:path";
import { PYTHON_INDEX_MODULE, TYPESCRIPT_INDEX_MODULE } from "src/constants";
import { PYTHON_PACKAGE_MARKER } from "src/constants";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type {
	RuleContract,
	SingleClassFileNameRuleContract,
	TestPathSyntaxContract,
	ViolationContract,
} from "src/protocols";
import { TestPathSyntax } from "src/test_path_syntax";
import type { AstClassNode } from "src/types";

/** Responsibilities: _class filename conversion_, _filename violation reporting_. **/
export class SingleClassFileNameRule implements SingleClassFileNameRuleContract {
	private readonly rule: RuleContract;
	private readonly test_path_syntax: TestPathSyntaxContract;

	/** Responsibilities: _file eligibility classification_. **/
	private excluded_file(file: string): boolean {
		if (this.test_path_syntax.test_file(file, false)) {
			return true;
		}
		const name = basename(file);
		return name === TYPESCRIPT_INDEX_MODULE || name === PYTHON_INDEX_MODULE || name === PYTHON_PACKAGE_MARKER;
	}

	/** Responsibilities: _single-class file-name violation construction_. **/
	private append_class_violation(violations: ViolationContract[], file: string, class_node: AstClassNode): void {
		const actual_name = basename(file);
		const expected_name = this.expected_file_name(class_node.name, file);
		if (actual_name === expected_name) {
			return;
		}
		violations.push(this.rule.violation(file, class_node.start + 1, { expected_name }));
	}

	/** Responsibilities: _single-class file-name rule initialization_. **/
	public constructor() {
		this.rule = new DiagnosticRule("single-class-file-name");
		this.test_path_syntax = new TestPathSyntax();
	}

	/** Responsibilities: _single-class file-name violation addition_. **/
	public append(violations: ViolationContract[], file: string, classes: readonly AstClassNode[]): void {
		if (classes.length === 1 && !this.excluded_file(file)) {
			const class_node = classes.find((node) => !node.protocol && !node.type_contract);
			if (class_node !== undefined) {
				this.append_class_violation(violations, file, class_node);
			}
		}
	}

	/** Responsibilities: _focused class module identification_. **/
	public focused_class_file(file: string, classes: readonly AstClassNode[]): boolean {
		if (classes.length !== 1 || this.excluded_file(file)) {
			return false;
		}
		const class_node = classes[0];
		if (class_node === undefined || class_node.protocol || class_node.type_contract) {
			return false;
		}
		return basename(file) === this.expected_file_name(class_node.name, file);
	}

	/** Responsibilities: _class name file-name conversion_. **/
	public expected_file_name(class_name: string, file: string): string {
		const separated = class_name.replace(/([A-Z]+)([A-Z][a-z])/gu, "$1_$2").replace(/([a-z0-9])([A-Z])/gu, "$1_$2");
		const words = separated.split(/[_\s-]+/u).filter((word) => word.length > 0);
		return `${words.join("_").toLowerCase()}${extname(file)}`;
	}
}
