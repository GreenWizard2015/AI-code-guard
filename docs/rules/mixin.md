# `mixin`

**Purpose:** Mixins assemble implementation through inheritance, hiding ownership and state boundaries.

Before:

```ts
class LoggingMixin {
  public log(message: string): void {
    const normalized_message = message.trim();
    const log_entry = `[client] ${normalized_message}`;
    console.info(log_entry);
  }
}
```

```ts
class Client extends LoggingMixin {
  private readonly client_name = 'client';

  public request(): void {
    this.log('request');
    this.log('request complete');
  }
}
```

After:

```ts
interface Logger {
  log(message: string): void;
}

class Client {
  private readonly logger: Logger;

  public constructor(logger: Logger) {
    this.logger = logger;
  }

  public request(): void {
    this.logger.log('request');
  }
}
```

**Fix:** Move behavior into a focused collaborator and inject it through composition. Use a narrow interface or protocol for a shared contract instead of inheriting implementation.
