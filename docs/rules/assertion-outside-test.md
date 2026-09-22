# `assertion-outside-test`

Test assertions belong inside test cases. This rule is active only in test files; production files
are outside its scope.

The rule reports an assertion only when both conditions are true:

1. The file is recognized as a test file by its test directory or test suffix.
2. The assertion is outside the test function body.

**Bad — TypeScript test file:**

```ts
expect(response.body).toEqual(expected_body);
```

TypeScript checks only the Jest-style `expect(...)` call and requires it to be inside
`test("name", () => {})`. The same applies to the callback passed by `test.each(...)`.

**Good — TypeScript test file:**

```ts
test('returns the response', () => {
  const response = load_response();
  expect(response.body).toEqual(expected_body);
});
```

**Bad — Python test file:**

```py
assert response.status == 200
self.assertEqual(response.body, expected_body)
```

Python requires these assertions to be inside `def test_*`. `assert` and `self.assert*` in
production files are outside this rule.

**Good — Python test file:**

```py
class TestResponse(unittest.TestCase):
    def test_response(self) -> None:
        response = load_response()
        self.assertEqual(response.body, expected_body)
```

**Fix:** Move each assertion into the test case that verifies the behavior.
