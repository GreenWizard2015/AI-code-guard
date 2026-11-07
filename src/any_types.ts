import type { AstCallableNode, AstClassField } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ViolationContract } from "src/reporting_protocols";
import type {
	AnyTypeDiagnosticsContext,
	AnyTypeFieldDiagnosticsContext,
	AnyTypeParameterDiagnosticsContext,
	AnyTypesContract,
} from "src/shared_services_protocols";
import type { TypeScriptTypeAliasesContract } from "src/typescript_runtime_protocols";

/** Responsibilities: _any parameter diagnostics_, _any field diagnostics_. **/
export class AnyTypes implements AnyTypesContract {
	private readonly _type_aliases: TypeScriptTypeAliasesContract;
	private readonly _receiver_names: ReadonlySet<string>;

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

	/** Responsibilities: _aggregation callable parameter diagnostics_. **/
	private append_callable_parameters(violations: ViolationContract[], file: string, callable: AstCallableNode): void {
		const typed_arguments = callable.signature.typed_arguments;
		if (typed_arguments === undefined) {
			return;
		}
		for (const argument of typed_arguments) {
			this.append_parameter_info({ violations, file, callable, name: argument.name, type: argument.type });
		}
	}

	/** Responsibilities: _aggregation any diagnostic parameter_. **/
	private append_parameter_info(context: AnyTypeParameterDiagnosticsContext): void {
		const resolved_type = this._type_aliases.resolve(context.type);
		if (!this.is_generic_type(resolved_type) || this._receiver_names.has(context.name)) {
			return;
		}
		const rule = new DiagnosticRule("type-info");
		context.violations.push(
			rule.violation(context.file, context.callable.identity.start + 1, {
				subject: `parameter "${context.name}"`,
				type: resolved_type,
			}),
		);
		if (context.file.endsWith(".py") || resolved_type !== "unknown") {
			return;
		}
		const unknown_rule = new DiagnosticRule("typescript-unknown-parameter-type");
		context.violations.push(
			unknown_rule.violation(context.file, context.callable.identity.start + 1, { name: context.name }),
		);
	}

	/** Responsibilities: _aggregation any diagnostic return_. **/
	private append_return_info(violations: ViolationContract[], file: string, callable: AstCallableNode): void {
		const return_type = callable.signature.return_type;
		if (!return_type) {
			return;
		}
		const resolved_type = this._type_aliases.resolve(return_type);
		if (!this.is_generic_type(resolved_type)) {
			return;
		}
		const rule = new DiagnosticRule("type-info");
		violations.push(rule.violation(file, callable.identity.start + 1, { subject: "return type", type: resolved_type }));
	}

	/** Responsibilities: _aggregation any diagnostic field_. **/
	private append_field_info(context: AnyTypeFieldDiagnosticsContext, field: AstClassField): void {
		const resolved_type = this._type_aliases.resolve(field.type);
		if (!this.is_generic_type(resolved_type)) {
			return;
		}
		const rule = new DiagnosticRule("type-warning");
		context.violations.push(
			rule.violation(context.file, field.line + 1, {
				subject: `field "${field.name}"`,
				type: resolved_type,
			}),
		);
	}

	/** Responsibilities: _initialization type alias resolver_. **/
	public constructor(type_aliases: TypeScriptTypeAliasesContract) {
		this._type_aliases = type_aliases;
		this._receiver_names = new Set(["self", "cls", "_"]);
	}

	/** Responsibilities: _aggregation any diagnostics callable_. **/
	public append_any_info(context: AnyTypeDiagnosticsContext): void {
		for (const callable of [...context.functions, ...context.methods]) {
			this.append_callable_parameters(context.violations, context.file, callable);
			this.append_return_info(context.violations, context.file, callable);
		}
		this.append_field_infos({
			violations: context.violations,
			file: context.file,
			classes: context.classes,
		});
	}

	/** Responsibilities: _aggregation any diagnostic class_. **/
	public append_field_infos(context: AnyTypeFieldDiagnosticsContext): void {
		for (const item of context.classes) {
			let fields = item.field_analysis.fields;
			if (fields === undefined) {
				fields = [];
			}
			for (const field of fields) {
				this.append_field_info(context, field);
			}
		}
	}
}
