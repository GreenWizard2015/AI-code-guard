import { copyFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { RULE_DATA } from "src/parser/ts/constants";
import type { TaskWorkspaceProtocol } from "src/protocols";

/** Responsibilities: _rule documentation validation_, _rule documents copying_, _philosophy access projection_. **/
export class TaskDocumentation {
	private readonly documentation_root: string;

	/** Responsibilities: _rule document coverage validation_. **/
	private validate_rule_documents(): void {
		const documentation_directory = join(this.documentation_root, "docs", "rules");
		const rule_ids = new Set(Object.keys(RULE_DATA));
		for (const rule_id of rule_ids) {
			const documentation_file = join(documentation_directory, `${rule_id}.md`);
			if (!existsSync(documentation_file)) {
				throw new Error(`Rule "${rule_id}" is missing documentation: ${documentation_file}`);
			}
		}
		for (const file of readdirSync(documentation_directory)) {
			if (!file.endsWith(".md") || file === "README.md") {
				continue;
			}
			const rule_id = file.slice(0, -".md".length);
			if (!rule_ids.has(rule_id)) {
				throw new Error(`Documentation "${file}" has no matching rule in RULE_DATA.`);
			}
		}
	}

	/** Responsibilities: _documentation root initialization_. **/
	constructor(documentation_root: string) {
		this.documentation_root = documentation_root;
	}

	/** Responsibilities: _rule document coverage validation_. **/
	public validate(): void {
		this.architecture_review("{{REVIEW_PATH}}", "{{REVIEW_CODE}}");
		this.validate_rule_documents();
	}

	/** Responsibilities: _selection rule documents copying_. **/
	public copy_rule_documents(rule_ids: readonly string[], workspace: TaskWorkspaceProtocol): void {
		for (const rule_id of rule_ids) {
			const source = join(this.documentation_root, "docs", "rules", `${rule_id}.md`);
			copyFileSync(source, workspace.rule_document_path(rule_id));
		}
	}

	/** Responsibilities: _rule philosophy reading_. **/
	public philosophy(): string {
		const readme = readFileSync(join(this.documentation_root, "docs", "README.md"), "utf8");
		const start = readme.indexOf("## Rule philosophy");
		const end = readme.indexOf("\n## Requirements", start);
		if (start < 0 || end < 0) {
			throw new Error("docs/README.md does not contain the Rule philosophy section.");
		}
		return readme.slice(start, end).trim();
	}

	/** Responsibilities: _architecture review documentation reading_. **/
	public architecture_review(review_path: string, review_code: string): string {
		const document_path = join(this.documentation_root, "docs", "architecture-review.md");
		if (!existsSync(document_path)) {
			throw new Error(`Architecture review documentation is missing: ${document_path}`);
		}
		const document = readFileSync(document_path, "utf8");
		if (!document.includes("{{REVIEW_PATH}}")) {
			throw new Error(`Architecture review documentation must contain {{REVIEW_PATH}}: ${document_path}`);
		}
		if (!document.includes("{{REVIEW_CODE}}")) {
			throw new Error(`Architecture review documentation must contain {{REVIEW_CODE}}: ${document_path}`);
		}
		return document.replaceAll("{{REVIEW_PATH}}", review_path).replaceAll("{{REVIEW_CODE}}", review_code).trim();
	}
}
