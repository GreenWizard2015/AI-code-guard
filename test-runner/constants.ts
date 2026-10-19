import { dirname } from "node:path";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const TEST_RUNNER_ENTRY = "test-runner/cli.ts";
export const TESTS_DIRECTORY = "tests";
export const PYTHON_BRIDGE_DIRECTORY = "src/python-bridge";
export const PYTHON_TEST_DIRECTORY = "tests/python-bridge";
export const MIN_CONFIDENCE_ARGUMENT = "--min-confidence";
export const HEADLESS_ARGUMENT = "--headless";
export const FORCE_REVIEW_ARGUMENT = "--force-review";
export const REVIEW_CLEANUP_ARGUMENT = "--review-cleanup";
export const REVIEW_AGENT_OPTION = "--review-agent";
