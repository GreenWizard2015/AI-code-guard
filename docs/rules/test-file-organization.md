# Test file organization

Every test file below the project-root `tests/` or `__tests__/` directory must
mirror an existing module directory in the project root or `src/`. One or more
scope directories, including a subtype, may appear before the module or before
the test file.

```text
(tests|__tests__)/[scope[/subscope]/]path/to/module/**/test-file.ext
(tests|__tests__)/path/to/module/**/[scope[/subscope]/]test-file.ext
```

Good examples, when `src/payments/` exists:

```text
tests/payments/payment.test.ts
tests/unit/payments/payment.test.ts
tests/performance/load/payments/payment.test.ts
tests/payments/integration/payment.test.ts
tests/payments/acceptance/uat/payment.test.ts
__tests__/payments/api/payment.spec.ts
```

Bad examples:

```text
tests/payment.test.ts
tests/unit/missing/payment.test.ts
src/tests/payments/payment.test.ts
```

Keep test names compatible with the language runner: this project configures Jest for `.test.ts` and `.spec.ts` below root `tests/`, or any TypeScript file below root `__tests__/`; pytest uses `test_*.py` or `*_test.py`.
