import type { LintFileNameContract } from "src/core/support/protocols";
import { MAX_CAMEL_WORDS } from "src/metrics/constants";
import type { AstCallableIdentity, AstCallableNode, AstCallableSignature } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";

/** Responsibilities: _callable contract analysis_, _boolean flag analysis_. **/
export class CallableNamingAnalysis {
	private readonly _file_name: LintFileNameContract;
	private readonly _identity: AstCallableIdentity;
	private readonly _signature: AstCallableSignature;
	private readonly _violations: ViolationContract[];
	private readonly _result_rules: readonly { prefixes: readonly string[]; rule: RuleContract }[];
	private readonly _set_rule: RuleContract;
	private readonly _command_rules: readonly { prefixes: readonly string[]; rule: RuleContract }[];
	private readonly _and_rule: RuleContract;
	private readonly _long_rule: RuleContract;
	private readonly _flag_parameter_rule: RuleContract;
	private readonly _boolean_rules: readonly { prefixes: readonly string[]; rule: RuleContract }[];

	/** Responsibilities: _verb prefix matching_. **/
	private starts_with(symbol_name: string, prefixes: readonly string[]): boolean {
		for (const prefix of prefixes) {
			if (!symbol_name.startsWith(prefix)) {
				continue;
			}
			const boundary = symbol_name.slice(prefix.length, prefix.length + 1);
			if (boundary.length === 0 || boundary === "_" || /^\p{Lu}$/u.test(boundary)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _callable word count_. **/
	private method_words(symbol_name: string): number {
		if (symbol_name.startsWith("__") && symbol_name.endsWith("__")) {
			return 0;
		}
		let normalized_name = symbol_name;
		if (normalized_name.startsWith("_")) {
			normalized_name = normalized_name.slice(1);
		}
		if (normalized_name.includes("_")) {
			return normalized_name.split("_").filter(Boolean).length;
		}
		return this.camel_case_words(normalized_name);
	}

	/** Responsibilities: _camel-case word count_. **/
	private camel_case_words(identifier: string): number {
		let count = 0;
		const tokens = identifier.match(/\p{Lu}+(?=\p{Lu}\p{Ll}|$)|\p{Lu}\p{Ll}*|\p{Ll}+|\d+/gu);
		if (tokens !== null) {
			count = tokens.length;
		}
		return count;
	}

	/** Responsibilities: _result naming violations_. **/
	private append_result_rules(): void {
		if (this._signature.return_type === "boolean" || this._signature.return_type === "bool") {
			return;
		}
		if (["void", "None", "NoneType"].includes(this._signature.return_type)) {
			return;
		}
		if (this._identity.name === "build" && this._identity.owner.endsWith("Registry")) {
			return;
		}
		for (const group of this._result_rules) {
			if (this.starts_with(this._identity.name, group.prefixes)) {
				this._violations.push(
					group.rule.violation(this._file_name.value(), this._identity.start + 1, { name: this._identity.name }),
				);
				return;
			}
		}
	}

	/** Responsibilities: _setter naming violation_. **/
	private append_set_rule(): void {
		if (this.starts_with(this._identity.name, ["set"])) {
			this._violations.push(
				this._set_rule.violation(this._file_name.value(), this._identity.start + 1, { name: this._identity.name }),
			);
		}
	}

	/** Responsibilities: _command naming violations_. **/
	private append_command_rules(): void {
		for (const group of this._command_rules) {
			if (this.starts_with(this._identity.name, group.prefixes)) {
				this._violations.push(
					group.rule.violation(this._file_name.value(), this._identity.start + 1, { name: this._identity.name }),
				);
				return;
			}
		}
	}

	/** Responsibilities: _compound naming violations_. **/
	private append_compound_rules(): void {
		if (this._identity.name.includes("_and_") || /[a-z]And[A-Z]/u.test(this._identity.name)) {
			this._violations.push(
				this._and_rule.violation(this._file_name.value(), this._identity.start + 1, { name: this._identity.name }),
			);
		}
		if (this.method_words(this._identity.name) > MAX_CAMEL_WORDS) {
			this._violations.push(
				this._long_rule.violation(this._file_name.value(), this._identity.start + 1, { name: this._identity.name }),
			);
		}
	}

	/** Responsibilities: _boolean naming violations_. **/
	private append_boolean_rules(): void {
		if (this._signature.return_type !== "boolean" && this._signature.return_type !== "bool") {
			return;
		}
		for (const group of this._boolean_rules) {
			if (this.starts_with(this._identity.name, group.prefixes)) {
				this._violations.push(
					group.rule.violation(this._file_name.value(), this._identity.start + 1, { name: this._identity.name }),
				);
				return;
			}
		}
	}

	/** Responsibilities: _private callable contracts_. **/
	private append_private_node(): void {
		if (!this._file_name.value().endsWith(".py")) {
			return;
		}
		if (!this._identity.name.startsWith("_")) {
			return;
		}
		if (this._identity.name.startsWith("__") && this._identity.name.endsWith("__")) {
			return;
		}
		this.append_compound_rules();
	}

	/** Responsibilities: _public callable contracts_. **/
	private append_public_node(): void {
		this.append_result_rules();
		this.append_set_rule();
		this.append_command_rules();
		this.append_compound_rules();
		this.append_boolean_rules();
	}

	/** Responsibilities: _callable contract initialization_. **/
	public constructor(file_name: LintFileNameContract, callable: AstCallableNode, violations: ViolationContract[]) {
		this._file_name = file_name;
		this._identity = callable.identity;
		this._signature = callable.signature;
		this._violations = violations;
		this._set_rule = new DiagnosticRule("method-set-name");
		this._and_rule = new DiagnosticRule("method-and-name");
		this._long_rule = new DiagnosticRule("method-long-name");
		this._flag_parameter_rule = new DiagnosticRule("boolean-flag-parameter");
		this._result_rules = [
			{ prefixes: ["get"], rule: new DiagnosticRule("method-get-name") },
			{ prefixes: ["find", "fetch", "lookup"], rule: new DiagnosticRule("method-find-fetch-lookup-name") },
			{ prefixes: ["load", "read", "open"], rule: new DiagnosticRule("method-load-read-open-name") },
			{ prefixes: ["calculate", "compute"], rule: new DiagnosticRule("method-calculate-compute-name") },
			{ prefixes: ["create", "build", "generate"], rule: new DiagnosticRule("method-create-build-generate-name") },
			{ prefixes: ["parse", "convert", "transform"], rule: new DiagnosticRule("method-parse-convert-transform-name") },
		];
		this._command_rules = [
			{ prefixes: ["process"], rule: new DiagnosticRule("method-process-name") },
			{ prefixes: ["handle"], rule: new DiagnosticRule("method-handle-name") },
			{ prefixes: ["execute", "perform", "do"], rule: new DiagnosticRule("method-execute-perform-do-name") },
		];
		this._boolean_rules = [
			{ prefixes: ["is"], rule: new DiagnosticRule("boolean-is-name") },
			{ prefixes: ["exists"], rule: new DiagnosticRule("boolean-exists-name") },
			{ prefixes: ["equals"], rule: new DiagnosticRule("boolean-equals-name") },
			{ prefixes: ["has", "can"], rule: new DiagnosticRule("boolean-has-can-name") },
		];
	}

	/** Responsibilities: _callable naming rule application_. **/
	public append(): void {
		if (this._identity.name.startsWith("test_")) {
			return;
		}
		if (this._identity.owner === "" || this._identity.visibility !== "public") {
			this.append_private_node();
			return;
		}
		this.append_public_node();
	}

	/** Responsibilities: _boolean flag rule application_. **/
	public append_flag_parameter(): void {
		const count = this._signature.typed_arguments.filter(
			(argument) => argument.type === "boolean" || argument.type === "bool",
		).length;
		if (count < 2) {
			return;
		}
		this._violations.push(
			this._flag_parameter_rule.violation(this._file_name.value(), this._identity.start + 1, {
				name: this._identity.name,
				count: String(count),
			}),
		);
	}
}
