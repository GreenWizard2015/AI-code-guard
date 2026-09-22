# `module-protocols-separation`

Module-level protocols must be separated from implementation code in every ordinary file.
Move them to the exact sibling `protocols.ts` or `protocols.py`, or to one focused file when
the protocols belong together.

Do not keep module-level protocols beside implementation code.
