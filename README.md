# @lordcraymen/warmbuffer

A pre-warmed object buffer for TypeScript. It pre-generates a pool of instances in the background using microtasks, so hot-path consumers shift a ready-made value off the buffer instead of paying the construction cost inline.

## When it helps — and when it doesn't

WarmBuffer trades **memory and background CPU** for **hot-path latency**. The actual overhead depends on whether `uniqueness` is enabled:

- **Without `uniqueness`** (plain array path): ~`array.shift()` cost — essentially free for any factory that does real work.
- **With `uniqueness`** (Map path): composite key computation + `Map.set/delete` on every push/pop — noticeable overhead for sub-microsecond factories.

### Benchmarks (Node.js, V8)

**Full-pressure** (tight sync loop — buffer exhausts immediately, measures worst-case overhead):

| Factory | Cold (ops/s) | Warm (ops/s) | Verdict |
|---|---|---|---|
| `crypto.randomUUID()` — no uniqueness | 10,100,000 | 9,250,000 | ✅ **near parity, ~1.09× overhead** |
| `crypto.randomUUID()` — with uniqueness | 10,100,000 | 1,750,000 | ❌ key computation dominates, **7× slower** |
| `new LightObject()` — UUID ctor | 4,800,000 | 9,100,000 | ✅ **1.9× faster** |
| `new HeavyObject()` — array + reduce | 195,000 | 7,950,000 | ✅ **40× faster** |
| JSON payload — 20-element array | 720,000 | 8,180,000 | ✅ **11× faster** |

**Realistic** (microtask gap between calls — buffer has time to refill):

| Factory | Cold (ops/s) | Warm (ops/s) | Verdict |
|---|---|---|---|
| `crypto.randomUUID()` — no uniqueness | 4,710,000 | 2,390,000 | ⚠️ **~2× slower** — refill cost amortised over the gap |
| `crypto.randomUUID()` — with uniqueness | 4,710,000 | 877,000 | ❌ **5× slower** — refill is expensive relative to factory |

> The realistic gap in the no-uniqueness UUID case is partly noise: `Promise.resolve()` jitter on the cold side is ±14% rme, so the true gap is likely smaller.

**Rule of thumb:**
- ✅ Use WarmBuffer when your factory allocates collections, runs loops, calls multiple natives, or does async I/O.
- ✅ Skip `uniqueness` unless you actually need deduplication — the plain array path has negligible overhead.
- ❌ Don't use `uniqueness` for sub-microsecond factories — key computation costs more than the factory itself.
- ❌ Don't expect gains if the consumer outruns the microtask refill (sustained tight loops). WarmBuffer is designed for bursty or async consumers.

### Empty-buffer behaviour

When the buffer runs dry (burst exceeds refill rate), `get()` falls through to a direct factory call — same latency as cold — and schedules a microtask refill so subsequent calls can be warm again. There is no synchronous stall on the hot path.

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
