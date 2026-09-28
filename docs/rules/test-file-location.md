# Test file location

Test files must be located below the project-root `tests/` or `__tests__/`
directory. Nested `src/tests/` and `src/__tests__/` directories are not valid.

Jest test names use `.test.ts` or `.spec.ts` below root `tests/`; root
`__tests__` accepts TypeScript and TSX test names. Python tests use
`test_*.py` or `*_test.py` below root `tests/`.

Bad:

```text
src/parser.test.ts
src/parser_test.py
src/test_parser.py
src/parser.spec.ts
```

Good:

```text
tests/parser.test.ts
tests/parser_test.py
tests/test_parser.py
__tests__/parser.spec.ts
```
