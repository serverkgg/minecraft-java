import { describe, expect, it } from "bun:test";
import { type Bridge, BridgeDownloadError, BridgeUserError } from "@serverkgg/bridge";
import { installPurpur } from "./installPurpur";

const contextWith = (failure: Error | null) => {
	return {
		files: {
			download: async () => {
				if (failure) {
					throw failure;
				}
			},
			ensure: async () => undefined,
		},
	} as unknown as Bridge.Context;
};

const thrownBy = async (context: Bridge.Context) => {
	return await installPurpur(context, "1.99", null).then(
		() => null,
		(error: unknown) => error,
	);
};

describe("installing Purpur on a version it has no build for", () => {
	it("a 404 on the jar becomes text the customer can act on", async () => {
		const error = await thrownBy(contextWith(new BridgeDownloadError(404, "api.purpurmc.org answered 404")));

		expect(error).toBeInstanceOf(BridgeUserError);
		expect((error as BridgeUserError).text.en).toBe(
			"Purpur has no build for Minecraft 1.99 yet. Pick another version or server type.",
		);
		expect((error as BridgeUserError).text.ar).toBe(
			"لا يتوفر إصدار من Purpur لـ ماينكرافت 1.99 حتى الآن. اختر إصدارًا آخر أو نوع سيرفر آخر.",
		);
	});

	it("any other download failure keeps its own path", async () => {
		const failure = new BridgeDownloadError(503, "api.purpurmc.org answered 503");
		const error = await thrownBy(contextWith(failure));

		expect(error).toBe(failure);
	});

	it("a version Purpur does build installs as before", async () => {
		expect(await thrownBy(contextWith(null))).toBeNull();
	});
});
