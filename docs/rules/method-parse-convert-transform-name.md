# `method-parse-convert-transform-name`


Review public non-boolean result methods beginning with `parse*`, `convert*`,
or `transform*`. These names can expose a procedural `data → operation → data`
pipeline. Prefer the representation or value object: `parseJson()` → `json()`
or `ParsedJson`, `convertImage()` → `PngImage`.
