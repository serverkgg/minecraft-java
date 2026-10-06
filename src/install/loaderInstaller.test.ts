import { describe, expect, it } from "bun:test";
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

const errorOf = async (promise: Promise<unknown>) => {
	try {
		await promise;

		return null;
	} catch (error) {
		return error;
	}
};

describe("a loader installer that exits with an error", () => {
	it("names the loader and the exit code, and keeps the output for staff", async () => {
		const error = await runLoaderInstaller(contextWith(1), {
			name: "NeoForge",
			release: "21.1.77",
			installerUrl: "https://maven.neoforged.net/installer.jar",
			digest: "sha1:0000000000000000000000000000000000000000",
			javaMajor: 21,
		}).then(
			() => null,
			(thrown: unknown) => thrown,
		);

		expect(error).toBeInstanceOf(BridgeUserError);
		expect((error as BridgeUserError).text).toEqual({
			ar: "فشل NeoForge بكود الخروج 1.",
			en: "NeoForge failed with exit code 1.",
		});
		expect(String((error as BridgeUserError).cause)).toContain("could not reach maven");
	});
});

describe("runLoaderInstaller", () => {
	describe("a loader installer with no sha1 to check it against", () => {
		it("is never downloaded or run", async () => {
			const downloads: string[] = [];
			const runs: string[][] = [];

			const context = {
				files: {
					download: async (path: string) => {
						downloads.push(path);
					},
				},
				exec: async (args: string[]) => {
					runs.push(args);

					return {
						code: 0,
						stdout: "",
						stderr: "",
					};
				},
				log: () => {},
			} as unknown as Bridge.Context;

			const error = await errorOf(
				runLoaderInstaller(context, {
					name: "Forge",
					release: "1.20.1-47.4.0",
					installerUrl: "https://maven.minecraftforge.net/installer.jar",
					digest: null,
					javaMajor: 17,
				}),
			);

			expect(error).toBeInstanceOf(Error);
			expect(downloads).toEqual([]);
			expect(runs).toEqual([]);
		});

		it("is downloaded against the sha1 it was given", async () => {
			const checks: unknown[] = [];

			const context = {
				files: {
					download: async (_path: string, _url: string, check: unknown) => {
						checks.push(check);
					},
					remove: async () => {},
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

			await runLoaderInstaller(context, {
				name: "Forge",
				release: "1.20.1-47.4.0",
				installerUrl: "https://maven.minecraftforge.net/installer.jar",
				digest: "sha1:1111111111111111111111111111111111111111",
				javaMajor: 17,
			});

			expect(checks).toEqual([
				{
					digest: "sha1:1111111111111111111111111111111111111111",
				},
			]);
		});
	});
});
