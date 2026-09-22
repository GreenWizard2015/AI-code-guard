import { basename } from 'node:path';
import type { Violation } from 'src/protocols';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import { MIN_FILE_LINES } from 'src/constants';
import type { AstClassNode } from 'src/types';

/** Responsibilities: _classification directory protocols exception_. **/
export class DirectoryFileRules {
	public readonly FILE_SIZE_RULE = new DiagnosticRule('file-min-size');
	public readonly FILE_MAX_RULE = new DiagnosticRule('file-max-size');
	private readonly exception_names = new Set(['Error', 'Exception', 'BaseException']);

	/** Responsibilities: _classification protocol declarations grouped_. **/
	private should_group_protocols(line_count: number, classes: readonly AstClassNode[]): boolean {
		if (line_count >= MIN_FILE_LINES) {
			return false;
		}
		for (const class_node of classes) {
			if (class_node.protocol === true) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _classification class node represents_. **/
	private is_exception_class(class_node: AstClassNode): boolean {
		const base_names = [...class_node.base_class_names, class_node.base_class_name];
		return base_names.some(base_name => {
			if (this.exception_names.has(base_name)) {
				return true;
			}
return base_name.endsWith('Error') || base_name.endsWith('Exception');
		});
	}

	/** Responsibilities: _creation protocol grouping information_. **/
	public protocol_info(
		violations: Violation[],
		file: string,
		line_count: number,
		classes: readonly AstClassNode[]
	): boolean {
		const protocol_grouping_rule = new DiagnosticRule('protocol-grouping');

		if (!this.should_group_protocols(line_count, classes)) {
			return false;
		}
		violations.push(protocol_grouping_rule.violation(file, 1));
		return true;
	}

	/** Responsibilities: _reporting file entrypoint wrapper_. **/
	public entrypoint_wrapper(file: string): boolean {
		return basename(file) === 'test-runner.ts';
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
