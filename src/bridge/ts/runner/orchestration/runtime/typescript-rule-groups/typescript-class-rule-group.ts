import { ClassReporting } from 'src/bridge/ts/core/support/class-reporting';
import { DirectoryCommentSegments } from 'src/bridge/ts/core/support/directory-comment-segments';
import { MethodOrder } from 'src/bridge/ts/rules/method-order';
import { ClassStructureReporter } from 'src/metrics/class-structure-reporter';
import { MIN_FILE_LINES } from 'src/constants';
import type { Violation } from 'src/protocols';
import type { AstClassNode } from 'src/types';
import type { TypeScriptScannerRuleContext } from 'src/bridge/ts/runner/orchestration/runtime/types';
import type { TypeScriptRuleGroupContract } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/types';

/** Responsibilities: _class metrics application_, _application class structure ordering_. **/
export class TypeScriptClassRuleGroup implements TypeScriptRuleGroupContract {
	private readonly context: TypeScriptScannerRuleContext;
	private readonly class_reporting = new ClassReporting();
	private readonly method_order = new MethodOrder();
	private readonly segments = new DirectoryCommentSegments();

	/** Responsibilities: _aggregation metric ordering violations_. **/
	private append_class_metric(violations: Violation[], node: AstClassNode, suppress_short_class: boolean): void {
		this.class_reporting.report_class_methods(violations, this.context.file_name, node);
		const structure = new ClassStructureReporter(violations, this.context.file_name, node, suppress_short_class);
		structure.report_design();
		structure.report_sizes();
		if (!node.extends_external_class) {
			this.method_order.append_order_violations(violations, this.context.file_name.value, node);
		}
	}

	/** Responsibilities: _class rule context initialization_. **/
	public constructor(context: TypeScriptScannerRuleContext) {
		this.context = context;
	}

	/** Responsibilities: _aggregation class rule violations_. **/
	public append(violations: Violation[]): void {
		const classes = this.context.ast.classes;
		const suppress_short_class = classes.filter(node => !node.type_contract && !node.protocol).length >= 2 &&
			this.segments.count_code_lines(this.context.lines.join('\n'), false) < MIN_FILE_LINES;
		for (const node of classes) {
			this.append_class_metric(violations, node, suppress_short_class);
		}
	}
}
