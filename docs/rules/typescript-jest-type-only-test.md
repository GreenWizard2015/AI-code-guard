# `typescript-jest-type-only-test`

Every Jest test must verify an actual result or observable behavior. A test that
only checks types, fields, methods, or object shape is not a behavior test.

Bad:

```ts
test('constructs a resolver', () => {
	const resolver = new ProfileResolver();

expect(resolver).toBeInstanceOf(ProfileResolver);
});
```

```ts
test('exposes the resolver API', () => {
	const resolver = new ProfileResolver();

	expect(resolver).toHaveProperty('resolve');
	expect(resolver).toEqual(expect.objectContaining({
		cache: expect.any(Map),
	}));
});
```

`toBeInstanceOf`, `expect.any(...)`, `toHaveProperty`, and equivalent shape-only
assertions do not prove that the operation works. Add an assertion for the
returned value, state change, emitted request, or another observable result:

```ts
test('resolves a profile URL', () => {
	const resolver = new ProfileResolver();
	const urls = resolver.collect_profile_urls(document, location.href);

	expect(urls).toEqual(['https://example.test/profile']);
});
```

A runtime type assertion may accompany a behavior assertion, but it cannot be
the only assertion in the test.
