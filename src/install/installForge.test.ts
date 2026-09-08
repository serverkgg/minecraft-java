import { describe, expect, test } from "bun:test";
import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { installForge } from "./installForge";

const context = {} as unknown as Bridge.Context;

describe("installing Forge on a version it has no build for", () => {
	test("the customer is told which type and version, and what to do", async () => {
		const error = await installForge(context, "1.99", null, 21).then(
			() => null,
			(thrown: unknown) => thrown,
		);

		expect(error).toBeInstanceOf(BridgeUserError);
		expect((error as BridgeUserError).text.en).toBe(
			"Forge has no build for Minecraft 1.99 yet. Pick another version or server type.",
		);
		expect((error as BridgeUserError).text.ar).toContain("Forge");
		expect((error as BridgeUserError).text.ar).toContain("1.99");
	});
});
