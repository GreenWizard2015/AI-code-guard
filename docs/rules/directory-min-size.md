# `directory-min-size`

Description: A source directory must contain at least three implementation files. Tests and empty
directories do not count.

## Bad

```text
src/
└── feature/                 # only 2 implementation files
    ├── one.ts
    └── two.ts
```

## Good

```text
src/
└── feature/                 # 3 implementation files
    ├── one.ts
    ├── two.ts
    └── three.ts
```

