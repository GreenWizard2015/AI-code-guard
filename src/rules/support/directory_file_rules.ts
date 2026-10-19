import { basename } from "node:path";
import type { ViolationContract } from "src/protocols";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { RuleContract } from "src/protocols";
import {
	CLI_FILE_PREFIX,
	ERROR_CLASS_NAMES,
	ERROR_CLASS_SUFFIXES,
	MIN_FILE_LINES,
	PYTHON_RULE_IDS,
} from "src/constants";
import type { AstClassNode } from "src/types";

/** Responsibilities: _directory files_, _file naming_. **/
export class DirectoryFileRules {
	public readonly FILE_SIZE_RULE: RuleContract;
	public readonly FILE_MAX_RULE: RuleContract;
	private readonly exception_names: Set<string>;

	/** Responsibilities: _classification protocol declarations grouped_. **/
	private should_group_protocols(line_count: number, classes: readonly AstClassNode[]): boolean {
		if (line_count >= MIN_FILE_LINES) {
			return false;
		}
		for (const class_node of classes) {
			if (class_node.protocol) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _classification class node represents_. **/
	private is_exception_class(class_node: AstClassNode): boolean {
		const base_names = [...class_node.base_class_names, class_node.base_class_name];
		return base_names.some((base_name) => {
			if (this.exception_names.has(base_name)) {
				return true;
			}
			return ERROR_CLASS_SUFFIXES.some((suffix) => base_name.endsWith(suffix));
		});
	}

	/** Responsibilities: _file-size diagnostic initialization_. **/
	public constructor() {
		this.exception_names = new Set(ERROR_CLASS_NAMES);
		this.FILE_SIZE_RULE = new DiagnosticRule("file-min-size");
		this.FILE_MAX_RULE = new DiagnosticRule("file-max-size");
	}

	/** Responsibilities: _creation protocol grouping information_. **/
	public protocol_info(
		violations: ViolationContract[],
		file: string,
		line_count: number,
		classes: readonly AstClassNode[],
	): boolean {
		const protocol_grouping_rule = new DiagnosticRule(PYTHON_RULE_IDS.protocol_grouping);

		if (!this.should_group_protocols(line_count, classes)) {
			return false;
		}
		violations.push(protocol_grouping_rule.violation(file, 1));
		return true;
	}

	/** Responsibilities: _reporting file entrypoint wrapper_. **/
	public entrypoint_wrapper(file: string): boolean {
		const name = basename(file);
		return name.startsWith(CLI_FILE_PREFIX);
	}

	/** Responsibilities: _reporting file contains small_. **/
	public small_owner(classes: readonly AstClassNode[]): boolean {
		for (const class_node of classes) {
			if (class_node.is_data_class || class_node.protocol || this.is_exception_class(class_node)) {
				return true;
			}
		}
		return false;
	}
}
