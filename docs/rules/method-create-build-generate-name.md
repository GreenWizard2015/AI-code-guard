# `method-create-build-generate-name`


Review public non-boolean result methods beginning with `create*`, `build*`,
or `generate*`. Prefer the returned value: `createUser()` → `user()` and
`generateToken()` → `token()`.

This does not prohibit concrete commands. A method that changes the outside
world should use a verb and normally return `void`/`None`, such as
`register(user)` or `publish(article)`.
