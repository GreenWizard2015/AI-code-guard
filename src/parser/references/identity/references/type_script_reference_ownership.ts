import type {
	TypeScriptCallReturnsContract,
	TypeScriptInstanceAliasCollectorContract,
	TypeScriptPropertyStateContract,
	TypeScriptReferenceIdentityContract,
	TypeScriptInstanceStoreContract,
} from "src/model/protocols";
import ts from "typescript";
import type { CallableReferenceIdentity, StageOperation } from "src/types";
import type { TypeScriptPropertySide } from "src/types";
import { TypeScriptCallReturns } from "src/parser/references/identity/calls/type_script_call_returns";
import { TypeScriptInstanceIndex } from "src/parser/references/identity/instances/type_script_instance_index";
import { TypeScriptPropertyState } from "src/parser/references/identity/properties/type_script_property_state";
import { relative } from "node:path";
import { TypeScriptInstanceAliasCollector } from "src/parser/references/identity/instances/type_script_instance_alias_collector";
import { TypeScriptImportedInstanceAliases } from "src/parser/references/identity/calls/type_script_imported_instance_aliases";
import { TypeScriptReferenceImportState } from "src/parser/references/identity/references/type_script_reference_import_state";
import { TypeScriptReferenceIdentity } from "src/parser/references/identity/references/type_script_reference_identity";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { TypeScriptReferenceOwnershipContract } from "src/typescript_analysis_protocols";
import { INITIALIZED_REFERENCE_STATE, INITIALIZING_REFERENCE_STATE } from "src/constants";
import { TypeScriptThisReceiver } from "src/parser/references/instance/type_script_this_receiver";
import { INSTANCE_PROPERTY_SIDE } from "src/constants";

/** Responsibilities: _callable owners_, _member owners_. **/
export class TypeScriptReferenceOwnership implements TypeScriptReferenceOwnershipContract {
	protected readonly source_file: ts.SourceFile;
	protected readonly project_root: string;
	protected readonly aliases: Map<string, string>;
	protected readonly function_identities: Map<string, CallableReferenceIdentity>;
	protected readonly instances: TypeScriptInstanceStoreContract;
	protected readonly property_state: TypeScriptPropertyStateContract;
	protected readonly call_returns: TypeScriptCallReturnsContract;
	private readonly python_instance_collector: TypeScriptInstanceAliasCollectorContract;
	private readonly reference_identity: TypeScriptReferenceIdentityContract;
	private readonly stage_timer: LintStageTimerContract;
	private readonly source_files: ReadonlyMap<string, ts.SourceFile>;
	private readonly source_io: ProjectSourceIOContract;
	private readonly initialization_states: Set<string>;
	private readonly this_receiver: TypeScriptThisReceiver;
	/** Responsibilities: _optional reference initialization measurement_. **/
	private measure_initialization<T>(name: string, operation: StageOperation<T>): T {
		if (this.stage_timer === undefined) {
			return operation();
		}
		return this.stage_timer.measure(
			`startup.project-context.source-records.initialize.call-references.${name}`,
			operation,
		);
	}

	/** Responsibilities: _member owner resolution_. **/
	private member_owner(base_owner: string, name: string, side: TypeScriptPropertySide): string {
		if (!base_owner || !name) {
			return base_owner;
		}
		const owner = this.property_state.property_owner(base_owner, name, side);
		if (owner.length > 0) {
			return owner;
		}
		return base_owner;
	}

	/** Responsibilities: _new instance owner_. **/
	private new_instance_owner(expression: ts.NewExpression): string {
		if (!ts.isIdentifier(expression.expression)) {
			return "";
		}
		const name = expression.expression.text;
		const alias = this.aliases.get(name);
		if (alias === undefined) {
			return name;
		}
		return alias;
	}

	/** Responsibilities: _identifier owner name_. **/
	private identifier_owner(expression: ts.Identifier): string {
		const owner = this.instances.instance_owner(expression.text, expression);
		if (!owner.bound) {
			return expression.text;
		}
		return owner.value;
	}

	/** Responsibilities: _reference state initialization_. **/
	private initialize_imports(): void {
		this.measure_initialization("imports", () => {
			const import_state = new TypeScriptReferenceImportState(
				this.source_file,
				this.project_root,
				this.source_files,
				this.source_io,
			);
			import_state.append_function_files(this.function_identities);
			import_state.append_local_aliases(this.aliases);
		});
	}

	/** Responsibilities: _reference imported instance initialization_. **/
	private initialize_imported_instances(): void {
		this.measure_initialization("imported-instances", () => {
			const imported_instance_aliases = new TypeScriptImportedInstanceAliases(
				this.project_root,
				this.source_files,
				this.source_io,
			);
			for (const [name, owner] of imported_instance_aliases.imported_instance_aliases(this.source_file)) {
				this.instances.add(name, owner);
			}
		});
	}

	/** Responsibilities: _reference state initialization_. **/
	private initialize_state(): void {
		if (this.initialization_states.has(INITIALIZED_REFERENCE_STATE)) {
			return;
		}
		if (this.initialization_states.has(INITIALIZING_REFERENCE_STATE)) {
			return;
		}
		this.initialization_states.add(INITIALIZING_REFERENCE_STATE);
		this.initialize_imports();
		this.measure_initialization("properties", () => this.property_state.append_tree(this.source_file, ""));
		this.measure_initialization("variables-and-parameters", () => this.python_instance_collector.collect_bindings());
		this.initialize_imported_instances();
		this.initialization_states.add(INITIALIZED_REFERENCE_STATE);
	}

	/** Responsibilities: _expression owner resolution_. **/
	private expression_owner(expression: ts.Expression, current_owner: string): string {
		if (ts.isNewExpression(expression)) {
			return this.new_instance_owner(expression);
		}
		if (ts.isIdentifier(expression)) {
			return this.identifier_owner(expression);
		}
		if (expression.kind === ts.SyntaxKind.ThisKeyword) {
			return this.this_receiver.owner(expression);
		}
		if (ts.isCallExpression(expression)) {
			return this.call_owner(expression.expression, current_owner);
		}
		if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
			return this.method_owner(expression, current_owner);
		}
		return "";
	}

	/** Responsibilities: _member receiver side classification_. **/
	private member_side(expression: ts.Expression): TypeScriptPropertySide {
		if (expression.kind === ts.SyntaxKind.ThisKeyword) {
			return this.this_receiver.side(expression);
		}
		if (ts.isIdentifier(expression)) {
			if (this.reference_identity.class_receiver(expression.text)) {
				return "static";
			}
		}
		return INSTANCE_PROPERTY_SIDE;
	}

	/** Responsibilities: _source AST reference setup_. **/
	public constructor(
		source_file: ts.SourceFile,
		project_root: string,
		stage_timer: LintStageTimerContract,
		source_files: ReadonlyMap<string, ts.SourceFile>,
		source_io: ProjectSourceIOContract,
	) {
		this.aliases = new Map<string, string>();
		this.function_identities = new Map<string, CallableReferenceIdentity>();
		this.initialization_states = new Set<string>();
		this.source_file = source_file;
		this.project_root = project_root;
		this.stage_timer = stage_timer;
		this.source_files = source_files;
		this.source_io = source_io;
		this.this_receiver = new TypeScriptThisReceiver(this.source_file, this.aliases);
		this.instances = new TypeScriptInstanceIndex(source_file);
		this.call_returns = new TypeScriptCallReturns(source_file, this.aliases, project_root, source_files, source_io);
		this.property_state = new TypeScriptPropertyState(this.aliases, this, this.instances);
		this.reference_identity = new TypeScriptReferenceIdentity(source_file, project_root, source_files, source_io);
		this.python_instance_collector = new TypeScriptInstanceAliasCollector(
			source_file,
			this.aliases,
			this.instances,
			this.property_state,
			this,
		);
	}

	/** Responsibilities: _callable owner resolution_. **/
	public call_owner(expression: ts.Expression, current_owner: string = ""): string {
		this.initialize_state();
		if (ts.isIdentifier(expression)) {
			const visible_instance = this.instances.instance_owner(expression.text, expression);
			if (visible_instance.bound) {
				return visible_instance.value;
			}
			return this.call_returns.owner_for(expression.text, "", INSTANCE_PROPERTY_SIDE);
		}
		if (!ts.isPropertyAccessExpression(expression)) {
			return "";
		}
		const owner = this.method_owner(expression, current_owner);
		if (!owner) {
			return "";
		}
		return this.call_returns.owner_for(expression.name.text, owner, this.member_side(expression.expression));
	}

	/** Responsibilities: _property owner resolution_. **/
	public property_owner(expression: ts.PropertyAccessExpression, current_owner: string = ""): string {
		this.initialize_state();
		return this.expression_owner(expression.expression, current_owner);
	}

	/** Responsibilities: _function reference identity_. **/
	public function_reference(expression: ts.Identifier): CallableReferenceIdentity {
		this.initialize_state();
		const imported = this.function_identities.get(expression.text);
		if (imported !== undefined) {
			return {
				name: imported.name,
				target_file: relative(this.project_root, imported.target_file).replaceAll("\\", "/"),
			};
		}
		return {
			name: expression.text,
			target_file: relative(this.project_root, this.source_file.fileName).replaceAll("\\", "/"),
		};
	}

	/** Responsibilities: _method reference identity_. **/
	public method_reference(expression: ts.AccessExpression, current_owner: string = ""): CallableReferenceIdentity {
		this.initialize_state();
		const owner = this.method_owner(expression, current_owner);
		if (owner.length === 0) {
			return { name: this.reference_identity.member_name(expression), target_file: "" };
		}
		return this.reference_identity.method_reference(expression, owner);
	}

	/** Responsibilities: _method owner resolution_. **/
	public method_owner(expression: ts.AccessExpression, current_owner: string = ""): string {
		this.initialize_state();
		const base_owner = this.expression_owner(expression.expression, current_owner);
		return this.member_owner(
			base_owner,
			this.reference_identity.member_name(expression),
			this.member_side(expression.expression),
		);
	}
}
