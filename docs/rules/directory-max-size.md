# `directory-max-size`

Description: A source directory must contain at most forty implementation files. Tests do not
count. Split files by domain ownership into focused subdirectories.

## Bad

```text
src/
└── feature/                 # 41 implementation files
    ├── file_0.ts
    ├── file_1.ts
    ├── …
    └── file_40.ts
```

## Good

```text
src/
└── feature/                 # 40 implementation files
    ├── file_0.ts
    ├── file_1.ts
    ├── …
    └── file_39.ts
```

