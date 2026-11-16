import { ViolationValue } from "src/model/violation_value";

/** Responsibilities: _planner violation fixtures_, _priority distribution data_. **/
export class AgentPackagePlannerFindingFactory {
	/** Responsibilities: _planner violation values_. **/
	private violation(file: string, line: number, priority: number): ViolationValue {
		return new ViolationValue({
			file,
			line,
			message: `finding ${file}:${line}`,
			hint: "fix it",
			rule_id: "class-size",
			priority,
		});
	}

	/** Responsibilities: _indexed path violations_. **/
	public indexed(file_template: string, count: number, start_line: number, priority: number): ViolationValue[] {
		const violations: ViolationValue[] = [];
		for (let index = 0; index < count; index += 1) {
			const line = start_line + index;
			const file = file_template.replace("{index}", String(index));
			violations.push(this.violation(file, line, priority));
		}
		return violations;
	}

	/** Responsibilities: _repeated path violations_. **/
	public repeated(file: string, count: number, priority: number): ViolationValue[] {
		const violations: ViolationValue[] = [];
		for (let line = 1; line <= count; line += 1) {
			violations.push(this.violation(file, line, priority));
		}
		return violations;
	}
}
