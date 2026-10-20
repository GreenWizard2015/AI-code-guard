import ts from "typescript";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ViolationContract } from "src/reporting_protocols";
import type {
	CacheOperationInput,
	CacheKeyMismatch,
	CacheKeyOperation,
} from "src/linting/orchestration/runtime/typescript-rule-groups/types";
import { TypeScriptExpressionIdentity } from "src/model/type_script_expression_identity";

/** Responsibilities: _cache operation indexing_, _mismatched key detection_. **/
export class InconsistentCacheKey {
	private readonly rule: DiagnosticRule;
	private readonly expression_identity: TypeScriptExpressionIdentity;

	/** Responsibilities: _cache receiver classification_. **/
	private cache_receiver(node: ts.CallExpression, source_file: ts.SourceFile): boolean {
		if (!ts.isPropertyAccessExpression(node.expression)) {
			return false;
		}
		const receiver = node.expression.expression.getText(source_file).toLowerCase();
		if (receiver.includes("cache")) {
			return true;
		}
		return receiver.includes("memo");
	}

	/** Responsibilities: _cache operation mismatch_. **/
	private append_operation(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		reads: Map<string, string>,
		node: ts.Node,
	): boolean {
		if (!ts.isCallExpression(node)) {
			return false;
		}
		if (!ts.isPropertyAccessExpression(node.expression)) {
			return false;
		}
		if (!this.cache_receiver(node, source_file)) {
			return false;
		}
		const access = node.expression;
		return this.append_cache_arguments({ violations, file, source_file, reads, node, access });
	}

	/** Responsibilities: _cache argument operations_. **/
	private append_cache_arguments(input: CacheOperationInput): boolean {
		const { violations, file, source_file, reads, node, access } = input;
		const receiver = access.expression.getText(source_file);
		const operation = access.name.text;
		for (const key of node.arguments) {
			return this.append_key_operation({
				violations,
				file,
				source_file,
				reads,
				node,
				operation,
				receiver,
				key: this.cache_key(key),
			});
		}
		return false;
	}

	/** Responsibilities: _cache key mismatch_. **/
	private append_mismatch(data: CacheKeyMismatch): boolean {
		const { violations, file, source_file, node, reads, receiver, key } = data;
		const read_key = reads.get(receiver);
		if (read_key === undefined || read_key === key) {
			return false;
		}
		violations.push(this.rule.violation(
			file,
			source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line + 1,
		));
		return true;
	}

	/** Responsibilities: _cache key mismatch reporting_. **/
	private append_key_operation(operation_data: CacheKeyOperation): boolean {
		const { violations, file, source_file, reads, node, operation, receiver, key } = operation_data;
		if (operation === "get") {
			reads.set(receiver, key);
			return false;
		}
		if (operation !== "set") {
			return false;
		}
		return this.append_mismatch({ violations, file, source_file, node, reads, receiver, key });
	}

	/** Responsibilities: _callable key mismatch diagnostics_. **/
	private append_callable(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		callable: ts.Node,
	): void {
		const reads = new Map<string, string>();
		let reported = false;
		const visit = (node: ts.Node): void => {
			if (reported) {
				return;
			}
			if (node !== callable) {
				if (ts.isFunctionLike(node)) {
					return;
				}
			}
			reported = this.append_operation(violations, file, source_file, reads, node);
			if (!reported) {
				node.forEachChild(visit);
			}
		};
		visit(callable);
	}

	/** Responsibilities: _cache key analyzer initialization_. **/
	public constructor() {
		this.rule = new DiagnosticRule("incomplete-cache-key");
		this.expression_identity = new TypeScriptExpressionIdentity();
	}

	/** Responsibilities: _cache-key callable node diagnostics_. **/
	public append_node(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		node: ts.Node,
	): void {
		if (!ts.isFunctionLike(node)) {
			return;
		}
		if (ts.isSourceFile(node)) {
			return;
		}
		this.append_callable(violations, file, source_file, node);
	}

	/** Responsibilities: _cache key representation_. **/
	public cache_key(node: ts.Node): string {
		const text = this.expression_identity.value(node);
		if (text.length === 0) {
			return "<empty>";
		}
		return text;
	}

	/** Responsibilities: _source cache key diagnostics_. **/
	public append(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		test_file: boolean,
	): void {
		if (test_file) {
			return;
		}
		const visit = (node: ts.Node): void => {
			if (ts.isFunctionLike(node)) {
				if (!ts.isSourceFile(node)) {
					this.append_callable(violations, file, source_file, node);
				}
			}
			node.forEachChild(visit);
		};
		visit(source_file);
	}
}
