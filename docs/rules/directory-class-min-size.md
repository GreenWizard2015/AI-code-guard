# `directory-class-min-size`

Description: A source directory must contain at least three implementation classes. Do not add
placeholder classes; keep classes together only when they share a domain responsibility.

## Bad

```text
src/
└── feature/                 # 2 implementation classes
    ├── alpha.ts
    └── bravo.ts
```

## Good

```text
src/
└── feature/                 # 3 related implementation classes
    ├── alpha.ts
    ├── bravo.ts
    └── charlie.ts
```
