import { ClassReporting } from "src/core/support/source-analysis/class_reporting";
import { DirectoryCommentSegments } from "src/core/support/source-analysis/directory_comment_segments";
import { MethodOrder } from "src/rules/method_order";
import { ClassStructureReporter } from "src/metrics/class_structure_reporter";
import { MIN_FILE_LINES } from "src/constants";
import type { ViolationContract } from "src/reporting_protocols";
import type { AstClassNode } from "src/types";
import type { TypeScriptScannerRuleContextContract } from "src/model/types/types";
import type { TypeScriptRuleGroupContract } from "src/linting/orchestration/runtime/typescript-rule-groups/types";

/** Responsibilities: _class metrics application_, _application class structure ordering_. **/
export class TypeScriptClassRuleGroup implements TypeScriptRuleGroupContract {
	private readonly context: TypeScriptScannerRuleContextContract;
	private readonly class_reporting: ClassReporting;
	private readonly method_order: MethodOrder;
	private readonly segments: DirectoryCommentSegments;

	/** Responsibilities: _aggregation metric ordering violations_. **/
	private append_class_metric(
		violations: ViolationContract[],
		node: AstClassNode,
		suppress_short_class: boolean,
	): void {
		this.class_reporting.report_class_methods(violations, this.context.file_name, node);
		const structure = new ClassStructureReporter(violations, this.context.file_name, node, suppress_short_class);
		structure.report_design();
		structure.report_sizes();
		if (!node.extends_external_class) {
			this.method_order.append_order_violations(violations, this.context.file_name.value, node);
		}
	}

	/** Responsibilities: _class rule context initialization_. **/
	public constructor(context: TypeScriptScannerRuleContextContract) {
		this.class_reporting = new ClassReporting();
		this.method_order = new MethodOrder();
		this.segments = new DirectoryCommentSegments();
		this.context = context;
	}

	/** Responsibilities: _aggregation class rule violations_. **/
	public append(violations: ViolationContract[]): void {
		const classes = this.context.ast.classes;
		const suppress_short_class =
			classes.filter((node) => !node.type_contract && !node.protocol).length >= 2 &&
			this.segments.count_code_lines(this.context.lines.join("\n"), false) < MIN_FILE_LINES;
		for (const node of classes) {
			this.append_class_metric(violations, node, suppress_short_class);
		}
	}
}
