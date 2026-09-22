# `test-exception-only`

Tests must verify a result or observable behavior. A test that only checks
that an operation throws verifies an implementation detail instead of the
behavior visible to its caller.

Bad:

```ts
test('rejects an invalid request', async () => {
    await expect(request_handler.handle(invalid_request)).rejects.toThrow();
});
```

```python
def test_rejects_invalid_request(self) -> None:
    with self.assertRaises(ValueError):
        self.request_handler.handle(invalid_request)
```

Prefer testing the next public boundary and asserting its result:

```ts
test('returns a bad request response for invalid input', async () => {
    const response = await server.handle(invalid_request);

    expect(response).toEqual({ status: 400, body: { error: 'Invalid request' } });
});
```

If a direct return value does not exist, assert the observable response,
state change, emitted event, or persisted record at the next level above the
implementation under test.
