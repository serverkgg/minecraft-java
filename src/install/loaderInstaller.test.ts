import { describe, expect, test } from "bun:test";
import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { runLoaderInstaller } from "./loaderInstaller";

const contextWith = (code: number) => {
	return {
		net: {
			text: async () => {
				throw new Error("offline");
			},
		},
		files: {
			download: async () => {},
			remove: async () => {},
			exists: async () => false,
		},
		exec: async () => {
			return {
				code,
				stdout: "",
				stderr: "Exception in thread main: could not reach maven",
			};
		},
		log: () => {},
	} as unknown as Bridge.Context;
};

describe("a loader installer that exits with an error", () => {
	test("names the loader and the exit code, and keeps the output for staff", async () => {
		const error = await runLoaderInstaller(contextWith(1), {
			name: "NeoForge",
			release: "21.1.77",
			installerUrl: "https://maven.neoforged.net/installer.jar",
			javaMajor: 21,
		}).then(
			() => null,
			(thrown: unknown) => thrown,
		);

		expect(error).toBeInstanceOf(BridgeUserError);
		expect((error as BridgeUserError).text).toEqual({
			ar: "NeoForge فشل وطلع بكود 1.",
			en: "NeoForge failed with exit code 1.",
		});
		expect(String((error as BridgeUserError).cause)).toContain("could not reach maven");
	});
});
