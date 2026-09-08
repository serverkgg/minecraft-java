import { describe, expect, test } from "bun:test";
import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import type { FabricEntry } from "../shared";
import { installFabric } from "./installFabric";

const STABLE_INSTALLERS: FabricEntry[] = [
	{
		version: "1.1.0",
		stable: true,
	},
];

const context = {
	net: {
		json: async () => STABLE_INSTALLERS,
	},
} as unknown as Bridge.Context;

describe("installing Fabric on a version it has no loader build for", () => {
	test("the customer is told which type and version, and what to do", async () => {
		const error = await installFabric(context, "1.99", null).then(
			() => null,
			(thrown: unknown) => thrown,
		);

		expect(error).toBeInstanceOf(BridgeUserError);
		expect((error as BridgeUserError).text.en).toBe(
			"Fabric has no build for Minecraft 1.99 yet. Pick another version or server type.",
		);
		expect((error as BridgeUserError).text.ar).toContain("Fabric");
		expect((error as BridgeUserError).text.ar).toContain("1.99");
	});
});
