# `method-and-name`


Review public method names containing `_and_` or `And`. They often combine two
responsibilities: `saveAndReturn()`, `validateAndSave()`, or `findAndDelete()`.
Split the contracts unless the combined operation must be atomic. Builders
should not have side effects; manipulators should normally return `void`/`None`.
