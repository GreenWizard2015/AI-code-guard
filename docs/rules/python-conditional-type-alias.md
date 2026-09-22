# `python-conditional-type-alias`

Do not define type aliases inside conditional branches. The rule detects type-shaped annotated
assignments in any `if` or `else` branch without depending on condition or alias names. Ordinary
typed runtime values remain allowed.

Bad:

```py
if runtime_mode:
    InputValue: Alias = Request | Cache
```

Good:

```py
InputValue: Alias = Request | Cache
```

Allowed runtime value:

```py
if runtime_mode:
    input_value: Input = load_input()
```

Keep one stable type contract and make runtime compatibility explicit through imports or a focused
adapter. Do not declare a typed value inside a conditional branch.
