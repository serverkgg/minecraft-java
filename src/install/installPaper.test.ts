import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { installPaper } from "./installPaper";

describe("installPaper", () => {
	it("downloads the jar against its digest and size, and prepares the plugins folder", async () => {
		const checks: unknown[] = [];
		const ensured: string[] = [];
		const context = {
			files: {
				download: async (_path: string, _url: string, check: unknown) => {
					checks.push(check);
				},
				ensure: async (...paths: string[]) => {
					ensured.push(...paths);
				},
			},
		} as unknown as Bridge.Context;

		await installPaper(context, {
			build: "132",
			url: "https://fill-data.papermc.io/paper-1.21.11-132.jar",
			digest: "sha256:abc",
			sizeBytes: 42,
		});

		expect(checks).toEqual([
			{
				digest: "sha256:abc",
				sizeBytes: 42,
			},
		]);
		expect(ensured).toEqual([
			"plugins",
		]);
	});
});
