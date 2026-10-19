# `ai-code-guard-directory-ignored`

Description: Checks that the project's `.ai-code-guard` directory is ignored by Git. The
directory contains generated reports, caches, and review state and should not
be committed with source code.

## Bad

```text
project/
├── .gitignore                 # does not ignore generated state
└── .ai-code-guard/
    ├── cache/
    └── report.md
```

The project-root `.gitignore` does not contain an entry for `.ai-code-guard/`.

## Good

```text
project/
├── .gitignore                 # contains /.ai-code-guard/
└── .ai-code-guard/            # generated; ignored by Git
    ├── cache/
    └── report.md
```

The project-root `.gitignore` contains `.ai-code-guard/` or `/.ai-code-guard/`.
