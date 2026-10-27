import { describe, expect, it } from "bun:test";
import { isUnder } from "./staging";

describe("deciding whether a path sits inside a staging directory", () => {
	it("a child of the directory is inside it", () => {
		expect(isUnder(".serverk-uploads/world/level.dat", ".serverk-uploads/world")).toBe(true);
	});

	it("the directory itself is not inside itself", () => {
		expect(isUnder(".serverk-uploads/world", ".serverk-uploads/world")).toBe(false);
		expect(isUnder(".serverk-uploads/world/", ".serverk-uploads/world")).toBe(false);
	});

	it("a sibling that merely shares the prefix is outside", () => {
		expect(isUnder(".serverk-uploads/world-old/level.dat", ".serverk-uploads/world")).toBe(false);
	});
});
