import { expect, test } from "bun:test";
import type { SidecarEntry } from "./addonSidecar";
import type { ResolvedAddon } from "./dependencies";
import { assertInstallSafety } from "./installSafety";

const addon = (project: string, filename = `${project}.jar`): ResolvedAddon => ({
	project,
	release: {
		version: "1",
		title: project,
		icon: null,
		pageUrl: null,
		gameVersions: null,
		loaders: null,
		serverSide: null,
		dependencies: [],
		file: {
			filename,
			url: "https://example.com/addon.jar",
			digest: null,
			sizeBytes: null,
		},
	},
});
const tracked = (project: string, provider = "modrinth"): SidecarEntry => ({
	project,
	provider,
	version: "1",
	title: project,
	gameVersion: "1.21.1",
	icon: null,
	pageUrl: null,
});
const present =
	(...names: string[]) =>
	async (filename: string) =>
		names.includes(filename);

test("rejects another tracked project's filename even when its binary is parked", async () => {
	await expect(
		assertInstallSafety(
			[
				addon("new", "shared.jar"),
			],
			"modrinth",
			{
				"shared.jar": tracked("other"),
			},
			present("shared.jar.disabled"),
		),
	).rejects.toThrow();
});
test("rejects same project id owned by another provider", async () => {
	await expect(
		assertInstallSafety(
			[
				addon("same"),
			],
			"modrinth",
			{
				"same.jar": tracked("same", "hangar"),
			},
			present("same.jar"),
		),
	).rejects.toThrow();
});
test("protects manually uploaded enabled and disabled files", async () => {
	for (const filename of [
		"new.jar",
		"new.jar.disabled",
	]) {
		await expect(
			assertInstallSafety(
				[
					addon("new"),
				],
				"modrinth",
				{},
				present(filename),
			),
		).rejects.toThrow();
	}
});
test("permits replacing the selected addon's own disabled binary", async () => {
	await assertInstallSafety(
		[
			addon("root"),
		],
		"modrinth",
		{
			"root.jar": tracked("root"),
		},
		present("root.jar.disabled"),
	);
});
test("blocks an enabled addon that requires a disabled library before downloads", async () => {
	await expect(
		assertInstallSafety(
			[
				addon("root"),
				addon("library", "library-new.jar"),
			],
			"modrinth",
			{
				"library-old.jar": tracked("library"),
			},
			present("library-old.jar.disabled"),
		),
	).rejects.toThrow();
});
test("accepts existing enabled dependencies and rejects duplicate planned destinations", async () => {
	await assertInstallSafety(
		[
			addon("root"),
			addon("library"),
		],
		"modrinth",
		{
			"library.jar": tracked("library"),
		},
		present("library.jar"),
	);
	await expect(
		assertInstallSafety(
			[
				addon("root", "same.jar"),
				addon("library", "same.jar"),
			],
			"modrinth",
			{},
			present(),
		),
	).rejects.toThrow();
});
