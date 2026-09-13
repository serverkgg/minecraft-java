import { expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { replaceFiles } from "./stagedFiles";

const fixture = (failDownload = false, failMove = false) => {
	const files = new Map([
		[
			"mods/old.jar",
			"old",
		],
	]);
	const context = {
		files: {
			ensure: async () => {},
			exists: async (path: string) => files.has(path),
			remove: async (path: string) => {
				for (const key of files.keys()) {
					if (key === path || key.startsWith(`${path}/`)) {
						files.delete(key);
					}
				}
			},
			download: async (path: string) => {
				if (failDownload) {
					throw new Error("download failed");
				}
				files.set(path, "new");
			},
			move: async (from: string, to: string) => {
				if (failMove && to === "mods/new.jar") {
					throw new Error("move failed");
				}
				const content = files.get(from);
				if (!content) {
					throw new Error("missing source");
				}
				files.set(to, content);
				files.delete(from);
			},
		},
	} as unknown as Bridge.Context;
	return {
		context,
		files,
	};
};
const replacement = [
	{
		path: "mods/new.jar",
		url: "https://example.com/new.jar",
	},
];

test("a failed download preserves the old installation", async () => {
	const { context, files } = fixture(true);
	await expect(
		replaceFiles(
			context,
			replacement,
			[
				"mods/old.jar",
			],
			async () => {},
		),
	).rejects.toThrow();
	expect(files.get("mods/old.jar")).toBe("old");
});

test("a failed replacement restores parked files", async () => {
	const { context, files } = fixture(false, true);
	await expect(
		replaceFiles(
			context,
			replacement,
			[
				"mods/old.jar",
			],
			async () => {},
		),
	).rejects.toThrow();
	expect(files.get("mods/old.jar")).toBe("old");
});

test("a failed metadata commit rolls back binary changes", async () => {
	const { context, files } = fixture();
	await expect(
		replaceFiles(
			context,
			replacement,
			[
				"mods/old.jar",
			],
			async () => {
				throw new Error("metadata failed");
			},
		),
	).rejects.toThrow();
	expect(files.get("mods/old.jar")).toBe("old");
	expect(files.has("mods/new.jar")).toBe(false);
});

test("successful replacement commits metadata and removes staging", async () => {
	const { context, files } = fixture();
	let committed = false;
	await replaceFiles(
		context,
		replacement,
		[
			"mods/old.jar",
		],
		async () => {
			committed = true;
		},
	);
	expect(committed).toBe(true);
	expect([
		...files.entries(),
	]).toEqual([
		[
			"mods/new.jar",
			"new",
		],
	]);
});
