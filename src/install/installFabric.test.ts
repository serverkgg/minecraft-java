import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { installFabric } from "./installFabric";

describe("installFabric", () => {
	it("downloads the server jar it was given and prepares the mods folder", async () => {
		const downloads: string[][] = [];
		const ensured: string[] = [];
		const context = {
			files: {
				download: async (path: string, url: string) => {
					downloads.push([
						path,
						url,
					]);
				},
				ensure: async (...paths: string[]) => {
					ensured.push(...paths);
				},
			},
		} as unknown as Bridge.Context;

		const url = "https://meta.fabricmc.net/v2/versions/loader/1.21.1/0.16.0/1.1.0/server/jar";

		await installFabric(context, {
			build: "0.16.0",
			url,
			digest: null,
			sizeBytes: null,
		});

		expect(downloads).toEqual([
			[
				"server.jar",
				url,
			],
		]);
		expect(ensured).toEqual([
			"mods",
		]);
	});
});
