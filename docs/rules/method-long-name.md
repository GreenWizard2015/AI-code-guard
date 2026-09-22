# `method-long-name`


Review CamelCase method names containing more than six words, such as
`findCurrentUserByEmailAddress()` or
`registerServletContainerInitializerToDriveServletContextInitializers()`.
For Python, `_name` is private and `__name__` is a magic method; neither is
counted as an ordinary method name.
The name may be compensating for an oversized class scope. Inspect the class
boundary and decompose responsibilities before shortening mechanically.
