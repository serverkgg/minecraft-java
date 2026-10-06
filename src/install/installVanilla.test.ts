import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { installVanilla } from "./installVanilla";

describe("installVanilla", () => {
	it("downloads the server jar against Mojang's sha1 and size", async () => {
		const checks: unknown[] = [];
		const context = {
			files: {
				download: async (_path: string, _url: string, check: unknown) => {
					checks.push(check);
				},
			},
		} as unknown as Bridge.Context;

		await installVanilla(context, {
			build: null,
			url: "https://piston-data.mojang.com/server.jar",
			digest: "sha1:def",
			sizeBytes: 7,
		});

		expect(checks).toEqual([
			{
				digest: "sha1:def",
				sizeBytes: 7,
			},
		]);
	});
});
