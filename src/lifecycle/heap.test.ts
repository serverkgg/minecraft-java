import { describe, expect, test } from "bun:test";
import { heapFor } from "./heap";

describe("sizing the jvm heap from the plan's memory", () => {
	test("a small server keeps the full headroom for the jvm itself", () => {
		expect(heapFor(1024)).toBe(512);
		expect(heapFor(2048)).toBe(1536);
	});

	test("a large server is capped at four fifths of its memory", () => {
		expect(heapFor(8192)).toBe(6553);
		expect(heapFor(16_384)).toBe(13_107);
	});

	test("the cap and the headroom meet at the point where the smaller one takes over", () => {
		expect(heapFor(2560)).toBe(2048);
		expect(heapFor(3072)).toBe(2457);
	});

	test("a plan too small to run minecraft is refused instead of booting into a crash", () => {
		expect(() => heapFor(1023)).toThrow();
		expect(() => heapFor(512)).toThrow();
	});
});
