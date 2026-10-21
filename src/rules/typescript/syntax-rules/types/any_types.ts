import type { AnyTypesContract } from "src/shared_services_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { AstCallableNodeContract, AstClassNodeContract } from "src/types";
import type { TypeScriptTypeAliasesContract } from "src/typescript_runtime_protocols";

/** Responsibilities: _any parameter diagnostics_, _any field diagnostics_. **/
export class AnyTypes implements AnyTypesContract {
	private readonly type_aliases: TypeScriptTypeAliasesContract;

	/** Responsibilities: _generic type classification_. **/
	private is_generic_type(type: string): boolean {
		switch (type) {
			case "Any":
			case "any":
			case "object":
			case "Object":
			case "unknown":
			case "typing.Any":
			case "typing_extensions.Any":
				return true;
			default:
				return false;
		}
	}

	/** Responsibilities: _aggregation any diagnostics callable_. **/
	private append_parameter_infos(
		violations: ViolationContract[],
		file: string,
		callable: AstCallableNodeContract,
	): void {
		let typed_arguments = callable.typed_arguments;
		if (typed_arguments === undefined) {
			typed_arguments = [];
		}
		for (const type of typed_arguments) {
			this.append_parameter_info(violations, file, callable, type.name, type.type);
		}
	}

	/** Responsibilities: _aggregation any diagnostic parameter_. **/
	private append_parameter_info(
		violations: ViolationContract[],
		file: string,
		callable: AstCallableNodeContract,
		name: string,
		type: string,
	): void {
		const is_receiver = name === "self" || name === "cls" || name === "_";
		const resolved_type = this.type_aliases.resolve(type);
		if (!this.is_generic_type(resolved_type) || is_receiver) {
			return;
		}
		const subject = `parameter "${name}"`;
		this.append_info(violations, file, callable, subject, resolved_type);
		if (file.endsWith(".py")) {
			return;
		}
		if (resolved_type === "unknown") {
			const rule = new DiagnosticRule("typescript-unknown-parameter-type");
			violations.push(rule.violation(file, callable.start + 1, { name }));
		}
	}

	/** Responsibilities: _aggregation any diagnostic callable_. **/
	private append_return_info(violations: ViolationContract[], file: string, callable: AstCallableNodeContract): void {
		const return_type = callable.return_type;
		if (!return_type) {
			return;
		}
		const resolved_type = this.type_aliases.resolve(return_type);
		if (!this.is_generic_type(resolved_type)) {
			return;
		}
		this.append_info(violations, file, callable, "return type", resolved_type);
	}

	/** Responsibilities: _aggregation normalization any diagnostic_. **/
	private append_info(
		violations: ViolationContract[],
		file: string,
		callable: AstCallableNodeContract,
		subject: string,
		type: string,
	): void {
		const line = callable.start + 1;
		const rule = new DiagnosticRule("type-info");
		violations.push(rule.violation(file, line, { subject, type }));
	}

	/** Responsibilities: _aggregation any diagnostic class_. **/
	private append_field_info(
		violations: ViolationContract[],
		file: string,
		name: string,
		type: string,
		line: number,
	): void {
		const resolved_type = this.type_aliases.resolve(type);
		if (!this.is_generic_type(resolved_type)) {
			return;
		}
		const rule = new DiagnosticRule("type-warning");
		violations.push(rule.violation(file, line, { subject: `field "${name}"`, type: resolved_type }));
	}

	/** Responsibilities: _initialization type alias resolver_. **/
	public constructor(type_aliases: TypeScriptTypeAliasesContract) {
		this.type_aliases = type_aliases;
	}

	/** Responsibilities: _aggregation any diagnostics callable_. **/
	public append_any_info(
		violations: ViolationContract[],
		file: string,
		functions: readonly AstCallableNodeContract[],
		methods: readonly AstCallableNodeContract[],
		classes: readonly AstClassNodeContract[],
	): void {
		for (const callable of [...functions, ...methods]) {
			this.append_parameter_infos(violations, file, callable);
			this.append_return_info(violations, file, callable);
		}
		this.append_field_infos(violations, file, classes);
	}

	/** Responsibilities: _aggregation any diagnostics class_. **/
	public append_field_infos(violations: ViolationContract[], file: string, classes: readonly AstClassNodeContract[]): void {
		for (const item of classes) {
			let fields = item.fields;
			if (fields === undefined) {
				fields = [];
			}
			for (const field of fields) {
				if (field.type !== undefined) {
					this.append_field_info(violations, file, field.name, field.type, field.line + 1);
				}
			}
		}
	}
}
