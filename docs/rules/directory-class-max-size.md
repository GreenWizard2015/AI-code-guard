# `directory-class-max-size`

Description: A source directory must contain at most fifteen implementation classes. Split
cohesive groups into focused subdirectories; do not add placeholder classes.

## Bad

```text
src/
└── feature/                 # 16 implementation classes
    ├── alpha.ts … papa.ts
```

## Good

```text
src/
├── feature/                 # 8 implementation classes
│   └── alpha.ts … hotel.ts
└── formatting/              # 8 implementation classes
    └── india.ts … papa.ts
```
