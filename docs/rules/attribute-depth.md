# `attribute-depth`

**Purpose:** Deep object graphs couple callers to implementation details.

```ts
request.session.user.profile.id
```

**Fix:** Add a named operation or narrow boundary; do not hide the chain in temporary variables.

