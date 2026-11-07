import { MarkdownTemplateBlock } from "documentation_validation/markdown_template_block";
import type { SystemFailureClassificationContract } from "src/analysis_protocols";

/** Responsibilities: _Markdown fenced template expansion_, _template discovery_. **/
export class MarkdownLoopExpander {
	private readonly _boundary_failures: SystemFailureClassificationContract;
	private readonly _template_pattern: RegExp;

	/** Responsibilities: _fenced block expansion_. **/
	private expand_fenced_block(fence: string): string {
		const fence_pattern = /^(```[^\r\n]*\r?\n)([\s\S]*?)(^```[\t ]*$)/mu;
		const match = fence_pattern.exec(fence);
		if (match === null) {
			return fence;
		}
		const opening = match[1];
		const body = match[2];
		const closing = match[3];
		if (opening === undefined || body === undefined || closing === undefined) {
			return fence;
		}
		const template = new MarkdownTemplateBlock(body, this._boundary_failures);
		if (!template.contains_template()) {
			return fence;
		}
		return opening + template.expand() + closing;
	}

	/** Responsibilities: _template expansion initialization_. **/
	public constructor(boundary_failures: SystemFailureClassificationContract) {
		this._boundary_failures = boundary_failures;
		this._template_pattern = /\{%[\t ]*(?:for|endfor|const)\b/u;
	}

	/** Responsibilities: _template source discovery_. **/
	public contains_template(template_source: string): boolean {
		if (!template_source.includes("{%")) {
			return false;
		}
		return this._template_pattern.test(template_source);
	}

	/** Responsibilities: _Markdown template expansion_. **/
	public expand(markdown_source: string): string {
		if (!markdown_source.includes("```") || !this.contains_template(markdown_source)) {
			return markdown_source;
		}
		return markdown_source.replace(/^(```[^\r\n]*\r?\n)([\s\S]*?)(^```[\t ]*$)/gmu, (fence) =>
			this.expand_fenced_block(fence),
		);
	}
}
