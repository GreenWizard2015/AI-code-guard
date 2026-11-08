import { REVIEW_PATCH_DENIAL_REASON } from "src/core/support/task/review-agent/constants";
import { ReviewPatchMutation } from "src/core/support/task/review-agent/policy/review_patch_mutation";
import type {
	ReviewDeletionPolicyContract,
	ReviewMutationPolicyContract,
	ReviewPatchRequest,
	ReviewPathPolicyContract,
	ReviewWriteRequest,
} from "src/core/support/task/review-agent/protocols";
import type { HookDecision } from "src/model_types";

/** Responsibilities: _patch authorization_, _issue deletion authorization_. **/
export class ReviewMutationPolicy implements ReviewMutationPolicyContract {
	private readonly _paths: ReviewPathPolicyContract;
	private readonly _deletion_policy: ReviewDeletionPolicyContract;

	/** Responsibilities: _policy initialization_. **/
	public constructor(paths: ReviewPathPolicyContract, deletion_policy: ReviewDeletionPolicyContract) {
		this._paths = paths;
		this._deletion_policy = deletion_policy;
	}

	/** Responsibilities: _review-file mutations_. **/
	public write_decision(request: ReviewWriteRequest): HookDecision {
		let path = request.file_path;
		if (path.length === 0) {
			path = request.fallback_path;
		}
		if (!this._paths.allows_file(path)) {
			return { allowed: false, reason: "Review writes must stay in .ai-code-guard/review/." };
		}
		if (this._deletion_policy.file(path, request.cwd).allows_write()) {
			return { allowed: true, reason: "" };
		}
		return { allowed: false, reason: "Only open review findings may be changed." };
	}

	/** Responsibilities: _patch authorization_. **/
	public patch_decision(request: ReviewPatchRequest): HookDecision {
		const mutation = new ReviewPatchMutation(request, this._paths, this._deletion_policy);
		if (mutation.allowed()) {
			return { allowed: true, reason: "" };
		}
		return {
			allowed: false,
			reason: REVIEW_PATCH_DENIAL_REASON,
		};
	}
}
