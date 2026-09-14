import { expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { cloneWorld, inspectJavaWorld, worldNameArgument, worldTools } from "./worldTools";

test("world names reject traversal and shell punctuation", () => {
	for (const name of [
		"../world",
		"",
		"/world",
		"$(touch file)",
		"world;rm",
		"a".repeat(33),
	]) {
		expect(() => worldNameArgument(name)).toThrow();
	}
	expect(worldNameArgument("our-world_2")).toBe("our-world_2");
});

test("a Bedrock world is rejected before any command", async () => {
	const context = {
		files: {
			exists: async () => true,
		},
	} as unknown as Bridge.Context;
	await expect(inspectJavaWorld(context, "world")).rejects.toThrow();
});

test("invalid Java headers are rejected and gzip Java metadata accepted", async () => {
	const context = (header: string) =>
		({
			files: {
				size: async () => 100,
				exists: async () => false,
			},
			exec: async () => ({
				stdout: header,
				code: 0,
			}),
		}) as unknown as Bridge.Context;
	await expect(inspectJavaWorld(context("08 00 00"), "world")).rejects.toThrow();
	await expect(inspectJavaWorld(context("1f 8b 08"), "world")).resolves.toBeUndefined();
});

test("create preserves the old world and changes only generation settings", async () => {
	const writes: unknown[] = [];
	const context = {
		files: {
			exists: async () => false,
		},
		codec: {
			javaProperties: {
				merge: async (_path: string, values: unknown) => {
					writes.push(values);
				},
			},
		},
		log: () => {},
	} as unknown as Bridge.Context;
	await worldTools.actions.create?.(context, {
		name: "new-world",
		seed: "123",
	});
	expect(writes).toEqual([
		{
			"level-seed": "123",
		},
		{
			"level-name": "new-world",
		},
	]);
});

test("clone refuses to overwrite an existing world", async () => {
	const context = {
		files: {
			exists: async () => true,
		},
	} as unknown as Bridge.Context;
	await expect(cloneWorld(context, "world", "existing")).rejects.toThrow();
});
