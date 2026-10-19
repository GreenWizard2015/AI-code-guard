import type { TemporalFieldEffect } from "src/linting/orchestration/runtime/typescript-rule-groups/temporal/types";

export const TEMPORAL_FIELD_READ_EFFECT: TemporalFieldEffect = { read: true, write: false };
export const TEMPORAL_FIELD_WRITE_EFFECT: TemporalFieldEffect = { read: false, write: true };
export const TEMPORAL_FIELD_READ_WRITE_EFFECT: TemporalFieldEffect = { read: true, write: true };
