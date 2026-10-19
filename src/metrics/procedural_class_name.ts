import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ViolationContract } from "src/protocols";
import type { AstClassNode } from "src/types";
import { RESOLVER_SUFFIX } from "src/metrics/constants";

/** Responsibilities: _procedural class names identification_, _naming violations addition_. **/
export class ProceduralClassName {
	private readonly job_title_suffixes = [
		"Manager",
		"Controller",
		"Handler",
		"Processor",
		"Helper",
		"Utils",
		"Utility",
		"Reader",
		"Writer",
		"Parser",
		"Validator",
		"Converter",
		"Sorter",
		"Encoder",
		"Decoder",
		"Router",
		"Dispatcher",
		"Listener",
		"Observer",
		"Runner",
		"Locator",
		"Client",
		"Service",
		"Factory",
		"Builder",
		"Provider",
		"Loader",
		"Fetcher",
		RESOLVER_SUFFIX,
		"Generator",
		"Calculator",
	] as const;

	/** Responsibilities: _regular plural job-title normalization_. **/
	private singular_name(name: string): string {
		if (name.endsWith("ies")) {
			return `${name.slice(0, -3)}y`;
		}
		if (name.endsWith("s")) {
			return name.slice(0, -1);
		}
		return name;
	}

	/** Responsibilities: _procedural suffix resolution_. **/
	private matching_suffix(name: string): string {
		const singular_name = this.singular_name(name);
		const suffix = this.job_title_suffixes.find(
			(candidate) => name.endsWith(candidate) || singular_name.endsWith(candidate),
		);
		if (suffix === undefined) {
			return "";
		}
		return suffix;
	}

	/** Responsibilities: _class name classification_. **/
	public job_title(name: string): boolean {
		return this.matching_suffix(name).length > 0;
	}

	/** Responsibilities: _aggregation procedural class-name violation_. **/
	public append_violation(violations: ViolationContract[], file: string, node: AstClassNode): void {
		if (!this.job_title(node.name)) {
			return;
		}
		const rule = new DiagnosticRule("procedural-class-name");
		violations.push(rule.violation(file, node.start + 1, { name: node.name }));
	}
}
