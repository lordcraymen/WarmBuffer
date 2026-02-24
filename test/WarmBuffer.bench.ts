import { bench, describe, beforeAll } from "vitest";
import { createWarmBuffer } from "../src/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A "heavy" object that does some work on construction */
class HeavyObject {
  id: string;
  values: number[];
  checksum: number;

  constructor() {
    this.id = crypto.randomUUID();
    this.values = Array.from({ length: 100 }, () => Math.random());
    this.checksum = this.values.reduce((a, b) => a + b, 0);
  }
}

/** A lightweight object */
class LightObject {
  id = crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// 1. UUID string — cheap factory
// ---------------------------------------------------------------------------

describe("UUID generation (cheap factory)", () => {
  const warmUUID = createWarmBuffer(() => crypto.randomUUID(), {
    warm: 20,
    refillAt: 5,
    uniqueness: [(s) => s],
  });

  bench("cold  — crypto.randomUUID() inline", () => {
    const _id = crypto.randomUUID();
  });

  bench("warm  — WarmBuffer UUID", () => {
    const _id = warmUUID();
  });
});

// ---------------------------------------------------------------------------
// 2. Lightweight class instantiation
// ---------------------------------------------------------------------------

describe("Lightweight class instantiation", () => {
  const warmLight = createWarmBuffer(LightObject, { warm: 20, refillAt: 5 });

  bench("cold  — new LightObject()", () => {
    const _o = new LightObject();
  });

  bench("warm  — WarmBuffer<LightObject>", () => {
    const _o = warmLight();
  });
});

// ---------------------------------------------------------------------------
// 3. Heavy class instantiation (array allocation + reduce)
// ---------------------------------------------------------------------------

describe("Heavy class instantiation (array + reduce)", () => {
  const warmHeavy = createWarmBuffer(HeavyObject, { warm: 20, refillAt: 5 });

  bench("cold  — new HeavyObject()", () => {
    const _o = new HeavyObject();
  });

  bench("warm  — WarmBuffer<HeavyObject>", () => {
    const _o = warmHeavy();
  });
});

// ---------------------------------------------------------------------------
// 4. Plain object factory with JSON-style payload
// ---------------------------------------------------------------------------

const makePayload = () => ({
  id: crypto.randomUUID(),
  timestamp: Date.now(),
  data: Array.from({ length: 20 }, (_, i) => ({ index: i, value: Math.random() })),
});

describe("JSON-style payload object", () => {
  const warmPayload = createWarmBuffer(makePayload, { warm: 20, refillAt: 5 });

  bench("cold  — inline factory", () => {
    const _o = makePayload();
  });

  bench("warm  — WarmBuffer payload", () => {
    const _o = warmPayload();
  });
});

// ---------------------------------------------------------------------------
// 5. Buffer overhead: warm but empty (worst-case: buffer exhausted, falls back to sync fill)
// ---------------------------------------------------------------------------

describe("WarmBuffer overhead when buffer is empty (worst-case)", () => {
  // warm=0 forces every call to produce on-demand — measures pure overhead
  const warmZero = createWarmBuffer(() => crypto.randomUUID(), { warm: 0 });

  bench("cold  — direct call", () => {
    const _id = crypto.randomUUID();
  });

  bench("warm=0 — no buffer, direct produce", () => {
    const _id = warmZero();
  });
});
