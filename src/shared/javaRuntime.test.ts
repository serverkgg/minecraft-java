import { describe, expect, test } from "bun:test";
import { javaBinary } from "./javaRuntime";

describe("choosing the java the game version asks for", () => {
	test("a major we ship is used as it is", () => {
		expect(javaBinary(8)).toBe("/opt/java/8/bin/java");
		expect(javaBinary(17)).toBe("/opt/java/17/bin/java");
		expect(javaBinary(21)).toBe("/opt/java/21/bin/java");
	});

	test("a major we do not ship rounds up to the next one we do", () => {
		expect(javaBinary(9)).toBe("/opt/java/17/bin/java");
		expect(javaBinary(16)).toBe("/opt/java/17/bin/java");
		expect(javaBinary(22)).toBe("/opt/java/25/bin/java");
	});

	test("a major newer than anything installed falls back to the newest one", () => {
		expect(javaBinary(26)).toBe("/opt/java/25/bin/java");
		expect(javaBinary(99)).toBe("/opt/java/25/bin/java");
	});
});
