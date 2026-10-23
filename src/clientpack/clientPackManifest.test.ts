import { describe, expect, it } from "bun:test";
import { BridgeUserError } from "@serverkgg/bridge";
import { parseCurseforgeManifest } from "../modpacks";
import { ServerVariant } from "../shared";
import type { ClientPackIdentity } from "./clientPackIdentity";
import { type ClientPackCurseforgeMod, clientPackManifest } from "./clientPackManifest";

const identity = (overrides: Partial<ClientPackIdentity> = {}): ClientPackIdentity => {
	return {
		name: "Friends SMP",
		version: "3",
		mcVersion: "1.20.1",
		variant: ServerVariant.Forge,
		loaderVersion: "47.2.0",
		...overrides,
	};
};

const JEI: ClientPackCurseforgeMod = {
	fileName: "jei-1.20.1-forge-15.3.0.4.jar",
	title: "Just Enough Items (JEI)",
	projectId: 238_222,
	fileId: 4_712_868,
	pageUrl: "https://www.curseforge.com/minecraft/mc-mods/jei",
};

const CREATE: ClientPackCurseforgeMod = {
	fileName: "create-1.20.1-0.5.1.f.jar",
	title: "Create",
	projectId: 328_085,
	fileId: 4_835_191,
	pageUrl: null,
};

const LOADERS = [
	{
		variant: ServerVariant.Fabric,
		mcVersion: "1.20.1",
		loaderVersion: "0.15.3",
		id: "fabric-0.15.3",
	},
	{
		variant: ServerVariant.Forge,
		mcVersion: "1.20.1",
		loaderVersion: "47.2.0",
		id: "forge-47.2.0",
	},
	{
		variant: ServerVariant.NeoForge,
		mcVersion: "1.21.1",
		loaderVersion: "21.1.72",
		id: "neoforge-21.1.72",
	},
];

describe("writing a client pack manifest", () => {
	it("writes the manifest the curseforge app imports, with the files in file name order", () => {
		const { manifest } = clientPackManifest(identity(), [
			JEI,
			CREATE,
		]);

		expect(manifest).toBe(`{
  "minecraft": {
    "version": "1.20.1",
    "modLoaders": [
      {
        "id": "forge-47.2.0",
        "primary": true
      }
    ]
  },
  "manifestType": "minecraftModpack",
  "manifestVersion": 1,
  "name": "Friends SMP",
  "version": "3",
  "author": "Serverk",
  "files": [
    {
      "projectID": 328085,
      "fileID": 4835191,
      "required": true
    },
    {
      "projectID": 238222,
      "fileID": 4712868,
      "required": true
    }
  ],
  "overrides": "overrides"
}`);
	});

	it("writes the same text whatever order the mods arrive in", () => {
		expect(
			clientPackManifest(identity(), [
				CREATE,
				JEI,
			]),
		).toEqual(
			clientPackManifest(identity(), [
				JEI,
				CREATE,
			]),
		);
	});

	it("names the loader after the server type and its build", () => {
		for (const loader of LOADERS) {
			const { manifest } = clientPackManifest(identity(loader), []);

			expect(JSON.parse(manifest).minecraft.modLoaders).toEqual([
				{
					id: loader.id,
					primary: true,
				},
			]);
		}
	});

	it("reads back through the package's own manifest parser for every mod loader", () => {
		for (const loader of LOADERS) {
			const parsed = parseCurseforgeManifest(
				clientPackManifest(identity(loader), [
					JEI,
					CREATE,
				]).manifest,
			);

			expect(parsed).toEqual({
				name: "Friends SMP",
				mcVersion: loader.mcVersion,
				variant: loader.variant,
				loaderVersion: loader.loaderVersion,
				overrides: "overrides",
				files: [
					{
						projectId: 328_085,
						fileId: 4_835_191,
						required: true,
					},
					{
						projectId: 238_222,
						fileId: 4_712_868,
						required: true,
					},
				],
			});
		}
	});

	it("passes a neoforge build that carries the minecraft version through unchanged, and the parser drops that prefix", () => {
		const { manifest } = clientPackManifest(
			identity({
				variant: ServerVariant.NeoForge,
				loaderVersion: "1.20.1-47.1.106",
			}),
			[],
		);

		expect(JSON.parse(manifest).minecraft.modLoaders.at(0).id).toBe("neoforge-1.20.1-47.1.106");

		const parsed = parseCurseforgeManifest(manifest);

		expect(parsed.mcVersion).toBe("1.20.1");
		expect(parsed.variant).toBe(ServerVariant.NeoForge);
		expect(parsed.loaderVersion).toBe("47.1.106");
	});

	it("refuses a server type that runs no mods", () => {
		for (const variant of [
			ServerVariant.Paper,
			ServerVariant.Purpur,
			ServerVariant.Vanilla,
		]) {
			expect(() => {
				clientPackManifest(
					identity({
						variant,
					}),
					[],
				);
			}).toThrow(BridgeUserError);
		}
	});

	it("tells the player which server type runs no mods", () => {
		let error: unknown;

		try {
			clientPackManifest(
				identity({
					variant: ServerVariant.Paper,
				}),
				[],
			);
		} catch (caught) {
			error = caught;
		}

		expect((error as BridgeUserError).text.en).toBe(
			"A Paper server runs no mods, so we can't build a modpack from it. Modpacks are for Fabric, Forge and NeoForge servers.",
		);
	});

	it("refuses an identity with no loader version", () => {
		expect(() => {
			clientPackManifest(
				identity({
					loaderVersion: "",
				}),
				[],
			);
		}).toThrow("a client pack needs both the minecraft version and the loader version");
	});
});

describe("writing a client pack mod list", () => {
	it("links each mod to its page, or to its curseforge project when it has none", () => {
		const { modlist } = clientPackManifest(identity(), [
			JEI,
			CREATE,
		]);

		expect(modlist).toBe(
			[
				"<ul>",
				'<li><a href="https://www.curseforge.com/projects/328085">Create</a></li>',
				'<li><a href="https://www.curseforge.com/minecraft/mc-mods/jei">Just Enough Items (JEI)</a></li>',
				"</ul>",
				"",
			].join("\n"),
		);
	});

	it("escapes a title and a page address for html", () => {
		const { modlist } = clientPackManifest(identity(), [
			{
				...JEI,
				title: `Tom & Jerry's <b>"mod"</b>`,
				pageUrl: "https://example.com/mod?a=1&b=2",
			},
		]);

		expect(modlist).toContain(
			'<li><a href="https://example.com/mod?a=1&amp;b=2">Tom &amp; Jerry&#39;s &lt;b&gt;&quot;mod&quot;&lt;/b&gt;</a></li>',
		);
	});

	it("links the curseforge project instead of a page address that is not a web page", () => {
		const { modlist } = clientPackManifest(identity(), [
			{
				...JEI,
				pageUrl: "javascript:alert(1)",
			},
		]);

		expect(modlist).toContain('<a href="https://www.curseforge.com/projects/238222">');
	});

	it("writes an empty list for a pack with no mods", () => {
		const text = clientPackManifest(identity(), []);

		expect(text.modlist).toBe("<ul>\n</ul>\n");
		expect(JSON.parse(text.manifest).files).toEqual([]);
	});
});
