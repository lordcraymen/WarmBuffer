type Primitive = string | number | boolean | bigint | symbol | null | undefined;

type Factory<T> = () => T;
type Ctor<T> = new (...args: any[]) => T;

type WarmBuffer<T> = {
  (): T;              // default getter (anonymous)
  get(): T;           // explicit getter
  size(): number;
  peek(): T | undefined;
  clear(): void;
  fillSync(): void;   // force synchronous refill to target
};

type WarmBufferOptions<T> = {
  warm?: number; // target buffer size (default 5)
  refillAt?: number; // when buffer size <= refillAt, schedule refill (default 1)
  uniqueness?: Array<(value: T) => Primitive>; // uniqueness key getters
  maxAttempts?: number; // attempts to find a unique entry during refill (default warm*50)
};

function isCtor<T>(x: Factory<T> | Ctor<T>): x is Ctor<T> {
  // best-effort: constructors have a prototype with a "constructor" backref
  return typeof x === "function" && !!(x as any).prototype?.constructor;
}

function makeKey<T>(value: T, selectors: Array<(v: T) => Primitive>): string {
  // stable composite key across primitive types
  // (tagging helps avoid "1" vs 1 collisions)
  const parts = selectors.map((sel) => {
    const k = sel(value);
    const t = k === null ? "null" : typeof k;
    return `${t}:${String(k)}`;
  });
  return parts.join("|");
}

function createWarmBuffer<T>(
  maker: Factory<T> | Ctor<T>,
  opts: WarmBufferOptions<T> = {}
): WarmBuffer<T> {
  const warm = opts.warm ?? 5;
  const refillAt = opts.refillAt ?? 1;
  const selectors = opts.uniqueness ?? [];
  const maxAttempts = opts.maxAttempts ?? warm * 50;

  const buf: T[] = [];
  const keySet = new Set<string>(); // tracks keys currently IN buffer
  let refillScheduled = false;

  const produceOne = (): T => (isCtor(maker) ? new maker() : maker());

  const tryPushUnique = (v: T): boolean => {
    if (selectors.length === 0) {
      buf.push(v);
      return true;
    }
    const k = makeKey(v, selectors);
    if (keySet.has(k)) return false;
    keySet.add(k);
    buf.push(v);
    return true;
  };

  const fillSync = () => {
    if (warm <= 0) return;

    let attempts = 0;
    while (buf.length < warm) {
      if (attempts++ >= maxAttempts) {
        // Avoid infinite loops if uniqueness space is too small
        break;
      }
      const v = produceOne();
      tryPushUnique(v);
    }
  };

  const scheduleRefill = () => {
    if (refillScheduled) return;
    refillScheduled = true;

    // refill outside the hot path
    queueMicrotask(() => {
      refillScheduled = false;
      fillSync();
    });
  };

  const get = (): T => {
    // Buffer empty — don't block the hot path with a sync fill.
    // Serve directly from the factory and schedule an async refill that
    // has a chance to run before the next consumer call.
    if (buf.length === 0) {
      scheduleRefill();
      return produceOne();
    }

    const v = buf.shift()!;

    // remove key from set when leaving buffer
    if (selectors.length) {
      const k = makeKey(v, selectors);
      keySet.delete(k);
    }

    if (buf.length <= refillAt) scheduleRefill();
    return v;
  };

  // initial warm-up (sync)
  fillSync();

  // callable default getter + methods
  const fn = (() => get()) as WarmBuffer<T>;
  fn.get = get;
  fn.size = () => buf.length;
  fn.peek = () => buf[0];
  fn.clear = () => {
    buf.length = 0;
    keySet.clear();
  };
  fn.fillSync = fillSync;

  return fn;
}

export type { WarmBuffer, WarmBufferOptions };
export { createWarmBuffer };


/* ------------------ usage examples ------------------ 

// Example 1: UUIDs (fast generator, prewarm 5)
const uuidBuffer = createWarmBuffer(() => crypto.randomUUID(), {
  warm: 5,
  refillAt: 2,
  uniqueness: [(s) => s], // ensure no duplicate strings IN the buffer
});

const id1 = uuidBuffer();     // default getter
const id2 = uuidBuffer.get(); // explicit getter

// Example 2: Objects (uniqueness by properties)
class User {
  constructor(
    public id: string = crypto.randomUUID(),
    public name: string = `user_${Math.random().toString(16).slice(2)}`
  ) {}
}

const userBuffer = createWarmBuffer(User, {
  warm: 5,
  refillAt: 2,
  uniqueness: [
    (u) => u.id,
    (u) => u.name,
  ],
});

const myUser = userBuffer(); // fresh instance
*/