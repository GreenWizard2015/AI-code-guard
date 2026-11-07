import type { NamingSupportContract } from "src/analysis_protocols";
import { MODULE_PROTOCOL_KIND } from "src/constants";
import { PYTHON_RULE_IDS, RULE_IDS } from "src/linting/constants";
import { PythonHacks } from "src/linting/orchestration/runtime/python/coding_rules/python_hacks";
import { PythonTestRuleCollector } from "src/linting/orchestration/runtime/python/coding_rules/python_test_rule_collector";
import type { PythonRuleInput } from "src/linting/types";
import { MetricViolations } from "src/metrics/metric_violations";
import { Syntax } from "src/parser/analysis/syntax";
import type {
	PythonArchitectureContract,
	PythonHacksContract,
	PythonTestRuleCollectorContract,
} from "src/python_protocols";
import type { MetricViolationsContract } from "src/reporting_protocols";
import { NamingSupport } from "src/rules/naming_support";
import { PythonArchitecture } from "src/rules/python_architecture";
import type { SyntaxContract } from "src/shared_services_protocols";

/** Responsibilities: _Python architecture_, _Python syntax_. **/
export class PythonArchitectureRuleCollector {
	private readonly _input: PythonRuleInput;
	private readonly _architecture: PythonArchitectureContract;
	private readonly _hacks: PythonHacksContract;
	private readonly _syntax: SyntaxContract;
	private readonly _naming: NamingSupportContract;
	private readonly _tests: PythonTestRuleCollectorContract;
	private readonly _metrics: MetricViolationsContract;

	/** Responsibilities: _Python architecture state_. **/
	public constructor(input: PythonRuleInput) {
		this._input = input;
		this._architecture = new PythonArchitecture(
			PYTHON_RULE_IDS.empty_contract,
			MODULE_PROTOCOL_KIND,
			PYTHON_RULE_IDS.data_class_method,
			PYTHON_RULE_IDS.abstract_class,
		);
		this._hacks = new PythonHacks(RULE_IDS.pointless_assignment);
		this._syntax = new Syntax();
		this._naming = new NamingSupport(
			input.file_name.value(),
			input.operations.named_symbols.filter((symbol) => symbol.name !== "__all__"),
			input.source.classes,
			[],
		);
		this._tests = new PythonTestRuleCollector(input);
		this._metrics = new MetricViolations(input.violations, input.file_name.value());
	}

	/** Responsibilities: _Python architecture violations_. **/
	public append_architecture_rules(): void {
		const { violations } = this._input;
		const { classes, python_imports } = this._input.source;
		const file_name = this._input.file_name;
		const { operations } = this._input;
		const file = file_name.value();
		this._architecture.append_architecture_violations({
			violations,
			file,
			accesses: operations.private_accesses,
			branches: operations.repeated_branches,
			classes,
			type_declarations: this._input.source.type_declarations,
			imports: python_imports,
		});
		this._hacks.append_assignment_violations(violations, file, operations.callables);
		this._metrics.append_depth_violations(operations.attribute_accesses);
		this._tests.append_shape();
		this._tests.append_assertions();
	}

	/** Responsibilities: _Python syntax_, _Python names_. **/
	public append_syntax_rules(): void {
		const { violations } = this._input;
		const file_name = this._input.file_name;
		const { operations } = this._input;
		const file = file_name.value();
		this._syntax.append_parse_issues(violations, file, operations.parse_issues, "python");
		this._naming.append_symbol_violations(violations);
		this._naming.append_type_violations(violations);
		this._naming.append_numeric_violations(violations);
	}
}
