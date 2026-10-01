import { copyFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { RULE_DATA } from "src/parser/ts/constants";
import type { TaskWorkspaceProtocol } from "src/protocols";

/** Responsibilities: _rule documentation validation_, _rule documents copying_, _philosophy access projection_. **/
export class TaskDocumentation {
	private readonly documentation_root: string;
	private readonly architecture_review_file: string;
	private readonly agent_file: string;

	/** Responsibilities: _rule document coverage validation_. **/
	private validate_rule_document(documentation_directory: string, rule_id: string): void {
		const documentation_file = join(documentation_directory, `${rule_id}.md`);
		if (!existsSync(documentation_file)) {
			throw new Error(`Rule "${rule_id}" is missing documentation: ${documentation_file}`);
		}
	}

	/** Responsibilities: _rule document name validation_. **/
	private validate_rule_names(documentation_directory: string, rule_ids: ReadonlySet<string>): void {
		for (const file of readdirSync(documentation_directory)) {
			if (!file.endsWith(".md")) {
				continue;
			}
			if (file === "README.md") {
				continue;
			}
			const rule_id = file.slice(0, -".md".length);
			if (!rule_ids.has(rule_id)) {
				throw new Error(`Documentation "${file}" has no matching rule in RULE_DATA.`);
			}
		}
	}

	/** Responsibilities: _rule document coverage validation_. **/
	private validate_rule_documents(): void {
		const documentation_directory = join(this.documentation_root, "docs", "rules");
		const rule_ids = new Set(Object.keys(RULE_DATA));
		for (const rule_id of rule_ids) {
			this.validate_rule_document(documentation_directory, rule_id);
		}
		this.validate_rule_names(documentation_directory, rule_ids);
	}

	/** Responsibilities: _architecture review document reading_. **/
	private read_architecture_review(): string {
		if (!existsSync(this.architecture_review_file)) {
			throw new Error(`Architecture review documentation is missing: ${this.architecture_review_file}`);
		}
		return readFileSync(this.architecture_review_file, "utf8");
	}

	/** Responsibilities: _agent instruction reading_. **/
	private agent_document(): string {
		if (!existsSync(this.agent_file)) {
			throw new Error(`Architecture review agent documentation is missing: ${this.agent_file}`);
		}
		return readFileSync(this.agent_file, "utf8");
	}

	/** Responsibilities: _console review document position_. **/
	private architecture_review_position(document: string): number {
		if (!document.includes("{{REVIEW_PATH}}")) {
			throw new Error(
				`Architecture review documentation must contain {{REVIEW_PATH}}: ${this.architecture_review_file}`,
			);
		}
		if (!document.includes("{{REVIEW_CODE}}")) {
			throw new Error(
				`Architecture review documentation must contain {{REVIEW_CODE}}: ${this.architecture_review_file}`,
			);
		}
		const review_start = document.indexOf("# Console architecture review instructions");
		if (review_start < 0) {
			throw new Error(
				`Architecture review documentation must contain # Console architecture review instructions: ${this.architecture_review_file}`,
			);
		}
		return review_start;
	}

	/** Responsibilities: _agent review document position_. **/
	private agent_position(document: string): number {
		if (!document.includes("{{REVIEW_PATH}}")) {
			throw new Error(`Architecture review agent documentation must contain {{REVIEW_PATH}}: ${this.agent_file}`);
		}
		const review_start = document.indexOf("# Architecture review subagent instructions");
		if (review_start < 0) {
			throw new Error(
				`Architecture review agent documentation must contain # Architecture review subagent instructions: ${this.agent_file}`,
			);
		}
		return review_start;
	}

	/** Responsibilities: _documentation root initialization_. **/
	constructor(documentation_root: string) {
		this.documentation_root = documentation_root;
		this.architecture_review_file = join(documentation_root, "docs", "architecture-review.md");
		this.agent_file = join(documentation_root, "docs", "architecture-review-agent.md");
	}

	/** Responsibilities: _rule document coverage validation_. **/
	public validate(): void {
		this.philosophy();
		this.agent_instruction("{{REVIEW_PATH}}");
		this.architecture_review("{{REVIEW_PATH}}", "{{REVIEW_CODE}}");
		this.validate_rule_documents();
	}

	/** Responsibilities: _task documentation copying_. **/
	public copy_rule_documents(rule_ids: readonly string[], workspace: TaskWorkspaceProtocol): void {
		for (const rule_id of rule_ids) {
			const source = join(this.documentation_root, "docs", "rules", `${rule_id}.md`);
			copyFileSync(source, workspace.rule_document_path(rule_id));
		}
	}

	/** Responsibilities: _rule philosophy reading_. **/
	public philosophy(): string {
		const document = this.agent_document();
		const start = document.indexOf("## Rule philosophy");
		const end = document.indexOf("\n# Architecture review subagent instructions", start);
		if (start < 0 || end < 0) {
			throw new Error(
				`Architecture review agent documentation does not contain the Rule philosophy section: ${this.agent_file}`,
			);
		}
		return document.slice(start, end).trim();
	}

	/** Responsibilities: _architecture review documentation reading_. **/
	public architecture_review(review_path: string, review_code: string): string {
		const document = this.read_architecture_review();
		const review_start = this.architecture_review_position(document);
		return document
			.slice(review_start)
			.replaceAll("{{REVIEW_PATH}}", review_path)
			.replaceAll("{{REVIEW_CODE}}", review_code)
			.trim();
	}

	/** Responsibilities: _agent instruction reading_. **/
	public agent_instruction(review_path: string): string {
		const document = this.agent_document();
		const review_start = this.agent_position(document);
		return document.slice(review_start).replaceAll("{{REVIEW_PATH}}", review_path).trim();
	}
}
