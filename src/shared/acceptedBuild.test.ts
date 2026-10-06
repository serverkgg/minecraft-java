import { describe, expect, it } from "bun:test";
import { type Bridge, BridgeNetError, BridgeUserError } from "@serverkgg/bridge";
import { acceptedBuild, buildCatalogue, paperBuildList } from "./acceptedBuild";
import {
	FABRIC_META,
	FORGE_MAVEN,
	FORGE_MAVEN_METADATA,
	FORGE_PROMOTIONS,
	MOJANG_MANIFEST,
	NEOFORGE_MAVEN,
	NEOFORGE_MAVEN_METADATA,
	PAPER_PROJECT,
	PURPUR_PROJECT,
} from "./minecraftMeta";
import { ServerVariant } from "./variant";

const SHA1 = "0123456789abcdef0123456789abcdef01234567";

const paperBuildOf = (id: number, channel: string) => {
	return {
		id,
		channel,
		downloads: {
			"server:default": {
				url: `https://fill-data.papermc.io/paper-${id}.jar`,
				size: id,
				checksums: {
					sha256: `sha256-of-${id}`,
				},
			},
		},
	};
};

const contextWith = (answers: Record<string, unknown>) => {
	const asked: string[] = [];
	const warned: string[] = [];

	const answer = (url: string) => {
		asked.push(url);

		const value = answers[url];

		if (value === undefined) {
			throw new BridgeNetError(404, `${url} answered 404`);
		}

		if (value instanceof Error) {
			throw value;
		}

		return value;
	};

	const context = {
		net: {
			json: async (url: string) => answer(url),
			text: async (url: string) => answer(url),
		},
		log: Object.assign(() => {}, {
			warn: (message: string) => {
				warned.push(message);
			},
		}),
	} as unknown as Bridge.Context;

	return {
		context,
		asked,
		warned,
	};
};

const refusalOf = async (promise: Promise<unknown>) => {
	try {
		await promise;

		return null;
	} catch (error) {
		return error;
	}
};

const FORGE_METADATA = [
	"1.20.1-47.2.0",
	"1.20.1-47.3.0",
	"1.20.1-47.4.0",
	"1.20.1-47.4.9",
	"26.3-62.0.1",
]
	.map((version) => `<version>${version}</version>`)
	.join("");

const NEOFORGE_METADATA = [
	"21.1.77",
	"21.1.80",
	"26.3.0.1-beta",
	"26.3.0.2-beta",
]
	.map((version) => `<version>${version}</version>`)
	.join("");

const FORGE_ANSWERS = {
	[FORGE_MAVEN_METADATA]: FORGE_METADATA,
	[FORGE_PROMOTIONS]: {
		promos: {
			"1.20.1-latest": "47.4.9",
			"1.20.1-recommended": "47.4.0",
			"26.3-latest": "62.0.1",
		},
	},
	[`${FORGE_MAVEN}/1.20.1-47.4.0/forge-1.20.1-47.4.0-installer.jar.sha1`]: SHA1,
	[`${FORGE_MAVEN}/1.20.1-47.2.0/forge-1.20.1-47.2.0-installer.jar.sha1`]: SHA1,
};

const OLD_FORGE_ANSWERS = {
	[FORGE_MAVEN_METADATA]: [
		"1.7.10-10.13.4.1614-1.7.10",
		"1.8.9-11.15.1.2318-1.8.9",
		"1.12.2-14.23.5.2859",
	]
		.map((version) => `<version>${version}</version>`)
		.join(""),
	[FORGE_PROMOTIONS]: {
		promos: {
			"1.7.10-recommended": "10.13.4.1614",
			"1.8.9-recommended": "11.15.1.2318",
			"1.12.2-recommended": "14.23.5.2859",
		},
	},
	[`${FORGE_MAVEN}/1.7.10-10.13.4.1614-1.7.10/forge-1.7.10-10.13.4.1614-1.7.10-installer.jar.sha1`]:
		"fccafccf8ad4ce6d9f008e786b48ff53172bf9de",
	[`${FORGE_MAVEN}/1.8.9-11.15.1.2318-1.8.9/forge-1.8.9-11.15.1.2318-1.8.9-installer.jar.sha1`]:
		"ec0293ff0776b8831f2ed90511bab76e635dda0c",
	[`${FORGE_MAVEN}/1.12.2-14.23.5.2859/forge-1.12.2-14.23.5.2859-installer.jar.sha1`]: SHA1,
};

describe("acceptedBuild", () => {
	describe("Paper accepts only a stable build", () => {
		const paperBuilds = (version: string) => `${PAPER_PROJECT}/versions/${version}/builds`;

		it("refuses a version that has only alpha and beta builds, in the words the customer sees", async () => {
			const { context } = contextWith({
				[paperBuilds("26.3")]: [
					paperBuildOf(157, "BETA"),
					paperBuildOf(3, "ALPHA"),
				],
			});

			const error = await refusalOf(acceptedBuild(context, ServerVariant.Paper, "26.3", null));

			expect(error).toBeInstanceOf(BridgeUserError);

			expect((error as BridgeUserError).text).toEqual({
				ar: "لا يتوفر إصدار مستقر من Paper لـ ماينكرافت 26.3 حتى الآن. اختر إصدارًا آخر أو نوع سيرفر آخر.",
				en: "Paper has no stable build for Minecraft 26.3 yet. Pick another version or server type.",
			});
		});

		it("refuses a version Paper does not know", async () => {
			const { context } = contextWith({});

			const error = await refusalOf(acceptedBuild(context, ServerVariant.Paper, "1.99", null));

			expect((error as BridgeUserError).text.en).toBe(
				"Paper has no stable build for Minecraft 1.99 yet. Pick another version or server type.",
			);
		});

		it("picks the newest stable build with its download, digest and size", async () => {
			const { context } = contextWith({
				[paperBuilds("1.21.11")]: [
					paperBuildOf(133, "BETA"),
					paperBuildOf(132, "STABLE"),
					paperBuildOf(131, "STABLE"),
				],
			});

			expect(await acceptedBuild(context, ServerVariant.Paper, "1.21.11", null)).toEqual({
				build: "132",
				url: "https://fill-data.papermc.io/paper-132.jar",
				digest: "sha256:sha256-of-132",
				sizeBytes: 132,
			});
		});

		it("refuses a requested build Paper no longer publishes, in the customer's words", async () => {
			const { context, warned } = contextWith({
				[paperBuilds("1.21.11")]: [
					paperBuildOf(132, "STABLE"),
				],
			});

			const error = await refusalOf(acceptedBuild(context, ServerVariant.Paper, "1.21.11", "47.4.0"));

			expect(error).toBeInstanceOf(BridgeUserError);
			expect((error as BridgeUserError).text).toEqual({
				ar: "الإصدار 47.4.0 من Paper لم يعد منشورًا. اختر إصدارًا آخر من المشغّل.",
				en: "Paper build 47.4.0 is no longer published. Pick another loader build.",
			});
			expect(warned).toEqual([]);
		});

		it("installs a requested build Paper publishes even when it is not the newest stable one", async () => {
			const { context } = contextWith({
				[paperBuilds("1.21.11")]: [
					paperBuildOf(133, "BETA"),
					paperBuildOf(132, "STABLE"),
				],
			});

			expect((await acceptedBuild(context, ServerVariant.Paper, "1.21.11", "133")).build).toBe("133");
		});

		it("passes an outage on as the network error, never as a missing build", async () => {
			const outage = new BridgeNetError(503, "fill.papermc.io answered 503");

			const { context } = contextWith({
				[paperBuilds("1.21.11")]: outage,
			});

			expect(await refusalOf(acceptedBuild(context, ServerVariant.Paper, "1.21.11", null))).toBe(outage);
		});
	});

	describe("Purpur accepts any build", () => {
		it("picks the newest build", async () => {
			const { context } = contextWith({
				[`${PURPUR_PROJECT}/1.21.4`]: {
					builds: {
						all: [
							"2400",
							"2401",
						],
					},
				},
			});

			expect(await acceptedBuild(context, ServerVariant.Purpur, "1.21.4", null)).toEqual({
				build: "2401",
				url: `${PURPUR_PROJECT}/1.21.4/2401/download`,
				digest: null,
				sizeBytes: null,
			});
		});

		it("refuses a version with no builds", async () => {
			const { context } = contextWith({});

			const error = await refusalOf(acceptedBuild(context, ServerVariant.Purpur, "1.99", null));

			expect((error as BridgeUserError).text.en).toContain("Purpur has no stable build for Minecraft 1.99");
		});
	});

	describe("Fabric accepts a stable loader on a stable game version", () => {
		const answers = {
			[`${FABRIC_META}/game`]: [
				{
					version: "1.21.1",
					stable: true,
				},
				{
					version: "26.3-rc-1",
					stable: false,
				},
			],
			[`${FABRIC_META}/loader`]: [
				{
					version: "0.17.0-beta.1",
					stable: false,
				},
				{
					version: "0.16.14",
					stable: true,
				},
			],
			[`${FABRIC_META}/installer`]: [
				{
					version: "1.1.0",
					stable: true,
				},
			],
		};

		it("picks the newest stable loader and the stable installer", async () => {
			const { context } = contextWith(answers);

			expect(await acceptedBuild(context, ServerVariant.Fabric, "1.21.1", null)).toEqual({
				build: "0.16.14",
				url: `${FABRIC_META}/loader/1.21.1/0.16.14/1.1.0/server/jar`,
				digest: null,
				sizeBytes: null,
			});
		});

		it("refuses a game version Fabric does not call stable", async () => {
			const { context } = contextWith(answers);

			const error = await refusalOf(acceptedBuild(context, ServerVariant.Fabric, "26.3-rc-1", null));

			expect((error as BridgeUserError).text.en).toContain("Fabric has no stable build for Minecraft 26.3-rc-1");
		});

		it("refuses while Fabric has no stable installer", async () => {
			const { context } = contextWith({
				...answers,
				[`${FABRIC_META}/installer`]: [
					{
						version: "1.2.0",
						stable: false,
					},
				],
			});

			const error = await refusalOf(acceptedBuild(context, ServerVariant.Fabric, "1.21.1", null));

			expect((error as BridgeUserError).text.en).toBe(
				"Fabric has no stable installer right now. Try again in a moment or pick another server type in the Version tab.",
			);
		});
	});

	describe("Forge accepts only the recommended build", () => {
		const answers = FORGE_ANSWERS;

		it("picks the recommended build, never the latest, with the installer's sha1", async () => {
			const { context } = contextWith(answers);

			expect(await acceptedBuild(context, ServerVariant.Forge, "1.20.1", null)).toEqual({
				build: "47.4.0",
				url: `${FORGE_MAVEN}/1.20.1-47.4.0/forge-1.20.1-47.4.0-installer.jar`,
				digest: `sha1:${SHA1}`,
				sizeBytes: null,
			});
		});

		it("refuses a version with only a latest promotion", async () => {
			const { context } = contextWith(answers);

			const error = await refusalOf(acceptedBuild(context, ServerVariant.Forge, "26.3", null));

			expect((error as BridgeUserError).text.en).toBe(
				"Forge has no stable build for Minecraft 26.3 yet. Pick another version or server type.",
			);
		});

		it("keeps a build a modpack or the installed server pins, when Forge publishes it", async () => {
			const { context } = contextWith(answers);

			expect((await acceptedBuild(context, ServerVariant.Forge, "1.20.1", "47.2.0")).build).toBe("47.2.0");
		});

		it("accepts the recommended build of an old version, which maven publishes with the game version as a suffix", async () => {
			const { context } = contextWith(OLD_FORGE_ANSWERS);

			expect(await acceptedBuild(context, ServerVariant.Forge, "1.7.10", null)).toEqual({
				build: "10.13.4.1614-1.7.10",
				url: `${FORGE_MAVEN}/1.7.10-10.13.4.1614-1.7.10/forge-1.7.10-10.13.4.1614-1.7.10-installer.jar`,
				digest: "sha1:fccafccf8ad4ce6d9f008e786b48ff53172bf9de",
				sizeBytes: null,
			});

			expect((await acceptedBuild(context, ServerVariant.Forge, "1.8.9", null)).build).toBe("11.15.1.2318-1.8.9");
			expect((await acceptedBuild(context, ServerVariant.Forge, "1.12.2", null)).build).toBe("14.23.5.2859");
		});

		it("refuses to resolve an installer Maven has no sha1 for", async () => {
			const { context } = contextWith({
				...answers,
				[`${FORGE_MAVEN}/1.20.1-47.4.0/forge-1.20.1-47.4.0-installer.jar.sha1`]: undefined,
			});

			const error = await refusalOf(acceptedBuild(context, ServerVariant.Forge, "1.20.1", null));

			expect(error).toBeInstanceOf(Error);
			expect(error).not.toBeInstanceOf(BridgeUserError);
		});
	});

	describe("NeoForge accepts a build that is not a beta", () => {
		const answers = {
			[NEOFORGE_MAVEN_METADATA]: NEOFORGE_METADATA,
			[`${NEOFORGE_MAVEN}/21.1.80/neoforge-21.1.80-installer.jar.sha1`]: SHA1,
		};

		it("picks the newest release build", async () => {
			const { context } = contextWith(answers);

			expect(await acceptedBuild(context, ServerVariant.NeoForge, "1.21.1", null)).toEqual({
				build: "21.1.80",
				url: `${NEOFORGE_MAVEN}/21.1.80/neoforge-21.1.80-installer.jar`,
				digest: `sha1:${SHA1}`,
				sizeBytes: null,
			});
		});

		it("refuses a version with beta builds only", async () => {
			const { context } = contextWith(answers);

			const error = await refusalOf(acceptedBuild(context, ServerVariant.NeoForge, "26.3", null));

			expect((error as BridgeUserError).text.en).toContain("NeoForge has no stable build for Minecraft 26.3");
		});
	});

	describe("Vanilla accepts a Mojang release", () => {
		const answers = {
			[MOJANG_MANIFEST]: {
				latest: {
					release: "1.21.4",
				},
				versions: [
					{
						id: "26w14a",
						type: "snapshot",
						url: "https://piston-meta.mojang.com/26w14a.json",
					},
					{
						id: "1.21.4",
						type: "release",
						url: "https://piston-meta.mojang.com/1.21.4.json",
					},
				],
			},
			"https://piston-meta.mojang.com/1.21.4.json": {
				downloads: {
					server: {
						url: "https://piston-data.mojang.com/server.jar",
						sha1: SHA1,
						size: 9,
					},
				},
			},
		};

		it("resolves the release's server jar with Mojang's sha1", async () => {
			const { context } = contextWith(answers);

			expect(await acceptedBuild(context, ServerVariant.Vanilla, "1.21.4", null)).toEqual({
				build: null,
				url: "https://piston-data.mojang.com/server.jar",
				digest: `sha1:${SHA1}`,
				sizeBytes: 9,
			});
		});

		it("refuses a snapshot", async () => {
			const { context } = contextWith(answers);

			const error = await refusalOf(acceptedBuild(context, ServerVariant.Vanilla, "26w14a", null));

			expect((error as BridgeUserError).text.en).toContain("Vanilla has no stable build for Minecraft 26w14a");
		});

		it("tells the customer when Mojang has no such version", async () => {
			const { context } = contextWith(answers);

			const error = await refusalOf(acceptedBuild(context, ServerVariant.Vanilla, "1.99", null));

			expect((error as BridgeUserError).text.en).toBe(
				"Minecraft has no version called 1.99. Pick another version in the Version tab.",
			);
		});
	});
});

describe("buildCatalogue", () => {
	it("offers Paper's stable builds only", async () => {
		const { context } = contextWith({
			[`${PAPER_PROJECT}/versions/1.21.11/builds`]: [
				paperBuildOf(133, "BETA"),
				paperBuildOf(132, "STABLE"),
			],
		});

		expect((await buildCatalogue(context, ServerVariant.Paper, "1.21.11")).accepted).toEqual([
			"132",
		]);
	});

	it("offers Forge's recommended build only", async () => {
		const { context } = contextWith(FORGE_ANSWERS);

		expect((await buildCatalogue(context, ServerVariant.Forge, "1.20.1")).accepted).toEqual([
			"47.4.0",
		]);
	});

	it("offers an old Forge version's recommended build under its suffixed name", async () => {
		const { context } = contextWith(OLD_FORGE_ANSWERS);

		expect((await buildCatalogue(context, ServerVariant.Forge, "1.7.10")).accepted).toEqual([
			"10.13.4.1614-1.7.10",
		]);
	});
});

describe("paperBuildList", () => {
	it("reads a version Paper does not know as no builds", async () => {
		const { context } = contextWith({});

		expect(await paperBuildList(context, "1.99")).toEqual([]);
	});

	it("rethrows any other failure as it came", async () => {
		const outage = new BridgeNetError(503, "fill.papermc.io answered 503");

		const { context } = contextWith({
			[`${PAPER_PROJECT}/versions/1.21.11/builds`]: outage,
		});

		expect(await refusalOf(paperBuildList(context, "1.21.11"))).toBe(outage);
	});
});
