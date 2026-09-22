# `mixed-module`

**Purpose:** Mixing ordinary classes and free functions blurs module ownership. Exception
classes may share a module with the parsing or validation functions that construct them.

Before:

```ts
export class MessageSender {
  private readonly channel: string;

  public constructor(channel: string) {
    this.channel = channel;
  }

  public send(message: string): void {}
}

export function normalize_message(value: string): string {
  return value.trim();
}
```

After:

```ts
// message-sender.ts
export class MessageSender {
  private readonly channel: string;

  public constructor(channel: string) {
    this.channel = channel;
  }

  public send(message: string): void {}
}

// message-normalizer.ts
export function normalize_message(value: string): string {
  return value.trim();
}
```

**Fix:** Split responsibilities into existing focused owners, or choose one ownership model for the module. Do not create a tiny wrapper module solely to move a function.
