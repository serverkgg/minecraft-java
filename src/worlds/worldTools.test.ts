import { expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
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

test("create preserves the old world, changes only generation settings and reports the new world", async () => {
	const writes: unknown[] = [];
	const reported: Bridge.Activity[] = [];
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
		activity: {
			report: (entry: Bridge.Activity) => {
				reported.push(entry);
			},
		},
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
	expect(reported).toEqual([
		{
			name: BridgeEventName.WorldCreated,
			text: {
				ar: "تم إنشاء ماب جديد new-world، ويتولّد مع التشغيل الجاي",
				en: "Created world new-world, it generates on the next start",
			},
			subject: "new-world",
			details: {
				world: "new-world",
				seed: "123",
			},
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
