# argument-count

Description: Replace a long positional call contract with a named request object that keeps the same operation and result.

## Bad

```ts
// File: src/message-sender.ts
export class MessageSender {
	public send(recipient: string, subject: string, body: string, content_type: string, priority: number, retry_limit: number): string { return `${recipient}:${subject}:${body}:${content_type}:${priority}:${retry_limit}`; }
}
```


## Good

```ts
// File: src/protocols.ts
interface MessageSenderContract {
	send(request: Request): string;
}
```

