import { describe, expect, it } from "bun:test";
import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { installForge } from "./installForge";

const context = {} as unknown as Bridge.Context;

const launcherless = {
	net: {
		text: async () => {
			throw new Error("offline");
		},
	},
	files: {
		download: async () => {},
		remove: async () => {},
		ensure: async () => {},
		exists: async () => false,
	},
	exec: async () => {
		return {
			code: 0,
			stdout: "",
			stderr: "",
		};
	},
	log: () => {},
} as unknown as Bridge.Context;

describe("installing Forge on a version it has no build for", () => {
	it("the customer is told which type and version, and what to do", async () => {
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

describe("a Forge installer that leaves no server launcher behind", () => {
	it("the customer is told to pick another build or version", async () => {
		const error = await installForge(launcherless, "1.20.1", "47.2.0", 21).then(
			() => null,
			(thrown: unknown) => thrown,
		);

		expect(error).toBeInstanceOf(BridgeUserError);
		expect((error as BridgeUserError).text.en).toBe(
			"The Forge installer finished without a server launcher for 1.20.1-47.2.0. Pick another Forge build or Minecraft version in the Version tab.",
		);
		expect((error as BridgeUserError).text.ar).toContain("Forge");
	});
});
