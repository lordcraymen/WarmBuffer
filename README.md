# @lordcraymen/warmbuffer

A pre-warmed object buffer for fast, low-latency object retrieval in TypeScript.

Instead of creating objects on demand (cold), `WarmBuffer` pre-generates a pool of instances in the background using microtasks — so your hot path always gets an immediately available value.

## Installation

```bash
npm install @lordcraymen/warmbuffer
```

## Usage

```typescript
import { createWarmBuffer } from "@lordcraymen/warmbuffer";

// Pre-warm 5 UUIDs, refill automatically when < 2 remain
const uuidBuffer = createWarmBuffer(() => crypto.randomUUID(), {
  warm: 5,
  refillAt: 2,
  uniqueness: [(s) => s], // no duplicates in buffer
});

const id = uuidBuffer();      // default call
const id2 = uuidBuffer.get(); // explicit getter
```

### With a class constructor

```typescript
class Point {
  x = Math.random();
  y = Math.random();
}

const pointBuffer = createWarmBuffer(Point, { warm: 10 });
const p = pointBuffer(); // instanceof Point
```

## API

### `createWarmBuffer<T>(maker, options?): WarmBuffer<T>`

| Option | Type | Default | Description |
|---|---|---|---|
| `warm` | `number` | `5` | Target buffer size |
| `refillAt` | `number` | `1` | Schedule async refill when size ≤ this value |
| `uniqueness` | `Array<(v: T) => Primitive>` | `[]` | Key selectors to prevent duplicate entries in the buffer |
| `maxAttempts` | `number` | `warm * 50` | Max attempts to find a unique entry before stopping |

### `WarmBuffer<T>` methods

| Method | Description |
|---|---|
| `buf()` | Get next value (default call) |
| `buf.get()` | Get next value (explicit) |
| `buf.size()` | Current number of buffered items |
| `buf.peek()` | Next value without consuming |
| `buf.clear()` | Empty the buffer |
| `buf.fillSync()` | Synchronously refill to target size |

## License

MIT
