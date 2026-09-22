# `typescript-jest-test-expect`

Every Jest test must contain an `expect` assertion directly in its callback body.

Do not hide the assertion in a helper callback, condition, or nested function. The
test must assert its observable result at the test level.
