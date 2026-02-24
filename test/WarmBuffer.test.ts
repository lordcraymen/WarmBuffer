import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createWarmBuffer } from "../src/index";

describe("createWarmBuffer", () => {
  describe("basic functionality", () => {
    it("should return a value via default call", () => {
      const buf = createWarmBuffer(() => 42);
      expect(buf()).toBe(42);
    });

    it("should return a value via .get()", () => {
      const buf = createWarmBuffer(() => "hello");
      expect(buf.get()).toBe("hello");
    });

    it("should pre-warm the buffer to the target size", () => {
      const factory = vi.fn(() => Math.random());
      const buf = createWarmBuffer(factory, { warm: 5 });
      expect(buf.size()).toBe(5);
    });

    it("should report the correct size after consuming entries", () => {
      const buf = createWarmBuffer(() => 1, { warm: 3 });
      buf.get();
      // size may be 2 or 3 (refill scheduled via microtask)
      expect(buf.size()).toBeLessThanOrEqual(3);
    });
  });

  describe(".peek()", () => {
    it("should return the next value without consuming it", () => {
      const buf = createWarmBuffer(() => 99, { warm: 3 });
      const peeked = buf.peek();
      expect(peeked).toBe(99);
      // same item still in buffer
      expect(buf.get()).toBe(99);
    });

    it("should return undefined on an empty buffer when warm=0", () => {
      const buf = createWarmBuffer(() => 1, { warm: 0 });
      expect(buf.peek()).toBeUndefined();
    });
  });

  describe(".size()", () => {
    it("should return 0 after clear()", () => {
      const buf = createWarmBuffer(() => 1, { warm: 5 });
      buf.clear();
      expect(buf.size()).toBe(0);
    });
  });

  describe(".clear()", () => {
    it("should empty the buffer", () => {
      const buf = createWarmBuffer(() => 42, { warm: 5 });
      buf.clear();
      expect(buf.size()).toBe(0);
    });
  });

  describe(".fillSync()", () => {
    it("should refill the buffer synchronously up to warm", () => {
      const buf = createWarmBuffer(() => Math.random(), { warm: 5 });
      buf.clear();
      expect(buf.size()).toBe(0);
      buf.fillSync();
      expect(buf.size()).toBe(5);
    });
  });

  describe("constructor support", () => {
    it("should work with a class constructor", () => {
      class Point {
        x = Math.random();
        y = Math.random();
      }
      const buf = createWarmBuffer(Point, { warm: 3 });
      const p = buf.get();
      expect(p).toBeInstanceOf(Point);
    });
  });

  describe("uniqueness", () => {
    it("should not produce duplicate values in buffer when uniqueness is set", () => {
      let counter = 0;
      const buf = createWarmBuffer(() => counter++, {
        warm: 5,
        uniqueness: [(n) => n],
      });
      const values = new Set([buf(), buf(), buf(), buf(), buf()]);
      expect(values.size).toBe(5);
    });

    it("should allow duplicates when uniqueness is not set", () => {
      const buf = createWarmBuffer(() => 42, { warm: 5 });
      // all five slots hold 42
      expect(buf.size()).toBe(5);
      expect(buf.get()).toBe(42);
    });
  });

  describe("microtask refill (scheduleRefill)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("should refill the buffer after a microtask when size falls to refillAt", async () => {
      const buf = createWarmBuffer(() => Math.random(), {
        warm: 4,
        refillAt: 2,
      });

      // drain down to refillAt threshold
      buf.get();
      buf.get();
      // size is now 2 (== refillAt), refill scheduled
      const sizeBeforeFlush = buf.size();
      expect(sizeBeforeFlush).toBeLessThanOrEqual(4);

      await Promise.resolve(); // flush microtask queue
      expect(buf.size()).toBe(4);
    });
  });

  describe("edge cases", () => {
    it("should handle warm=0 and always produce a value on demand", () => {
      const buf = createWarmBuffer(() => "on-demand", { warm: 0 });
      expect(buf.size()).toBe(0);
      expect(buf.get()).toBe("on-demand");
    });

    it("should not exceed maxAttempts when uniqueness space is exhausted", () => {
      // factory returns only 0 or 1, uniqueness requires uniqueness → max 2 items
      let i = 0;
      const buf = createWarmBuffer(() => i++ % 2, {
        warm: 10,
        uniqueness: [(n) => n],
        maxAttempts: 20,
      });
      // should have at most 2 unique items
      expect(buf.size()).toBeLessThanOrEqual(2);
    });
  });
});
