import type { ProcessSignalContract, SystemFailureClassificationContract } from "src/analysis_protocols";
import type { IOContract } from "src/io/protocols";

export type ReviewRecoveryClaimRaceSnapshot = {
	stale_contender_acquired: boolean;
	interleaved_claim_acquired: boolean;
	owner_after_interleaved_claim: string;
	final_owner: string;
};

export type CallableReviewRecoveryClaimStateReader = () => ReviewRecoveryClaimRaceSnapshot;

export type ReviewRecoveryClaimRaceFixture = {
	file_io: IOContract;
	owner_path: string;
	process_signal: ProcessSignalContract;
	failure_classification: SystemFailureClassificationContract;
	read_state: CallableReviewRecoveryClaimStateReader;
};
