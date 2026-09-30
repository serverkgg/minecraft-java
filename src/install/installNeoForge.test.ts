import { describe, expect, test } from "bun:test";
import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { installNeoForge } from "./installNeoForge";

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

describe("installing NeoForge on a version it has no build for", () => {
	test("the customer is told which type and version, and what to do", async () => {
		const error = await installNeoForge(context, "1.99", null, 21).then(
			() => null,
			(thrown: unknown) => thrown,
		);

		expect(error).toBeInstanceOf(BridgeUserError);
		expect((error as BridgeUserError).text.en).toBe(
			"NeoForge has no build for Minecraft 1.99 yet. Pick another version or server type.",
		);
		expect((error as BridgeUserError).text.ar).toContain("NeoForge");
		expect((error as BridgeUserError).text.ar).toContain("1.99");
	});
});

describe("a NeoForge installer that leaves no server launcher behind", () => {
	test("the customer is told to pick another build or version", async () => {
		const error = await installNeoForge(launcherless, "1.20.1", "21.1.77", 21).then(
			() => null,
			(thrown: unknown) => thrown,
		);

		expect(error).toBeInstanceOf(BridgeUserError);
		expect((error as BridgeUserError).text.en).toBe(
			"The NeoForge installer finished without a server launcher for 21.1.77. Pick another NeoForge build or Minecraft version in the Version tab.",
		);
		expect((error as BridgeUserError).text.ar).toContain("NeoForge");
	});
});
