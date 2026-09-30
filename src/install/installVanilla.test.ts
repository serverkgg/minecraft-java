import { describe, expect, test } from "bun:test";
import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { installVanilla } from "./installVanilla";

const context = {
	net: {
		json: async () => {
			return {
				latest: {
					release: "1.21.4",
					snapshot: "1.21.4",
				},
				versions: [],
			};
		},
	},
} as unknown as Bridge.Context;

describe("installing a minecraft version mojang does not list", () => {
	test("the customer is told to pick another version", async () => {
		const error = await installVanilla(context, "1.99").then(
			() => null,
			(thrown: unknown) => thrown,
		);

		expect(error).toBeInstanceOf(BridgeUserError);
		expect((error as BridgeUserError).text.en).toBe(
			"Minecraft has no version called 1.99. Pick another version in the Version tab.",
		);
		expect((error as BridgeUserError).text.ar).toContain("1.99");
	});
});
