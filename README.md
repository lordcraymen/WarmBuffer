# @lordcraymen/warmbuffer

A pre-warmed object buffer for TypeScript. It pre-generates a pool of instances in the background using microtasks, so hot-path consumers shift a ready-made value off the buffer instead of paying the construction cost inline.

## When it helps — and when it doesn't

WarmBuffer trades **memory and background CPU** for **hot-path latency**. The buffer overhead is a fixed ~0.5 µs per call (array shift + optional uniqueness bookkeeping). That cost only makes sense if your factory is meaningfully more expensive than the overhead itself.

Benchmarks (Node.js, V8):

| Factory | Cold (ops/s) | Warm (ops/s) | Verdict |
|---|---|---|---|
| `crypto.randomUUID()` — ~0.08 µs | 12,700,000 | 1,750,000 | ❌ overhead dominates, **7× slower** |
| `new LightObject()` — UUID ctor | 6,000,000 | 10,700,000 | ✅ **1.8× faster** |
| `new HeavyObject()` — array + reduce | 246,000 | 9,600,000 | ✅ **40× faster** |
| JSON payload — 20-element array | 837,000 | 9,200,000 | ✅ **11× faster** |

**Rule of thumb:** if your factory allocates collections, runs loops, calls multiple natives, or involves async I/O — WarmBuffer pays off. If it's a single native call, the buffer overhead exceeds the savings.

### Empty-buffer behaviour

When the buffer runs dry (e.g. traffic burst exceeds refill rate), `get()` falls through to a direct factory call — same latency as cold — and schedules a microtask refill so subsequent calls can be warm again. There is no synchronous stall on the hot path.

### Future use: object pooling

WarmBuffer is also a good foundation for **reusable-object pools** — especially relevant in JS where object allocation and GC pressure can add up on tight loops. Pairing it with factory functions that reset and return pooled instances is a natural next step.

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
| `buf.fillSync()` | Synchronously refill to target size (useful at startup) |

## License

MIT
