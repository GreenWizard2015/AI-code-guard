# `directory-max-source-subdirectories`

Description: A directory may contain at most ten immediate subdirectories that
contain project source files. Empty and test-only subdirectories do not count.
Group related source folders beneath a focused intermediate directory.

## Bad

```text
src/features/
├── feature_alpha/module.ts
├── feature_bravo/module.ts
├── …
└── feature_kestrel/module.ts  # 11 immediate source subdirectories
```

## Good

```text
src/features/                  # 2 immediate source subdirectories
├── feature_group_a/            # 6 child source directories
│   ├── feature_alpha/module.ts
│   ├── feature_bravo/module.ts
│   └── …
└── feature_group_b/            # 5 child source directories
    ├── feature_golf/module.ts
    ├── feature_harbor/module.ts
    └── …
```

