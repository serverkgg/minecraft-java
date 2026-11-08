import { describe, expect, it } from "bun:test";
import { BridgeDownloadError, BridgeUserError, describeDownloadFailure } from "@serverkgg/bridge";
import { downloadFailure } from "./modpackDownload";

describe("a modpack download that fails", () => {
	for (const status of [
		404,
		410,
		401,
		403,
		503,
		null,
	]) {
		it(`answering ${String(status)} becomes the customer's reason and keeps the original`, () => {
			const original = new BridgeDownloadError(status, "cdn.modrinth.com answered");
			const mapped = downloadFailure(original, "All the Mods 9 0.3.2");

			expect(mapped).toBeInstanceOf(BridgeUserError);
			expect((mapped as BridgeUserError).text).toEqual(describeDownloadFailure(original, "All the Mods 9 0.3.2"));
			expect((mapped as BridgeUserError).cause).toBe(original);
		});
	}

	it("anything that is not a download answer passes through untouched", () => {
		const original = new Error("digest mismatch");

		expect(downloadFailure(original, "mod.jar")).toBe(original);
	});
});
