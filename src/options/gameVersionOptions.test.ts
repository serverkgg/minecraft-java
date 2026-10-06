import { describe, expect, it } from "bun:test";
import { type Bridge, BridgeNetError } from "@serverkgg/bridge";
import { gameVersion } from "./gameVersionOptions";

const PAPER_PROJECT_URL = "https://fill.papermc.io/v3/projects/paper";

const buildsOf = (channel: string) => {
	return [
		{
			id: 1,
			channel,
			downloads: {},
		},
	];
};

const buildsUrlOf = (version: string) => {
	return `${PAPER_PROJECT_URL}/versions/${version}/builds`;
};

const optionsOf = async (variables: Record<string, string>, net: Record<string, unknown>) => {
	const asked: string[] = [];

	const answer = (url: string) => {
		asked.push(url);

		const value = net[url];

		if (value === undefined) {
			throw new BridgeNetError(404, `${url} answered 404`);
		}

		if (value instanceof Error) {
			throw value;
		}

		return value;
	};

	const context = {
		variable: (key: string) => variables[key] ?? null,
		net: {
			json: async (url: string) => answer(url),
			text: async (url: string) => answer(url),
		},
	} as unknown as Bridge.Context;

	const options = await gameVersion.list(context);

	return {
		values: options.map((option) => option.value),
		latest: options.find((option) => option.latest)?.value ?? null,
		asked,
	};
};

const PAPER_PROJECT_ANSWER = {
	[PAPER_PROJECT_URL]: {
		versions: {
			"26.3": [
				"26.3",
				"26.3-rc-3",
			],
			"26.2": [
				"26.2",
			],
			"1.21": [
				"1.21.11",
				"1.21.10",
			],
		},
	},
};

describe("gameVersion", () => {
	describe("the Paper version picker", () => {
		it("leaves out the newest versions that have no stable build", async () => {
			const { values, latest } = await optionsOf(
				{
					SERVER_TYPE: "paper",
				},
				{
					...PAPER_PROJECT_ANSWER,
					[buildsUrlOf("26.3")]: buildsOf("BETA"),
					[buildsUrlOf("26.2")]: buildsOf("STABLE"),
					[buildsUrlOf("1.21.11")]: buildsOf("STABLE"),
					[buildsUrlOf("1.21.10")]: buildsOf("STABLE"),
				},
			);

			expect(values).toEqual([
				"26.2",
				"1.21.11",
				"1.21.10",
			]);

			expect(latest).toBe("26.2");
		});

		it("leaves out an alpha-only version in the middle of the list", async () => {
			const { values } = await optionsOf(
				{
					SERVER_TYPE: "paper",
				},
				{
					...PAPER_PROJECT_ANSWER,
					[buildsUrlOf("26.3")]: buildsOf("STABLE"),
					[buildsUrlOf("26.2")]: buildsOf("ALPHA"),
					[buildsUrlOf("1.21.11")]: buildsOf("STABLE"),
					[buildsUrlOf("1.21.10")]: buildsOf("STABLE"),
				},
			);

			expect(values).toEqual([
				"26.3",
				"1.21.11",
				"1.21.10",
			]);
		});

		it("keeps a version whose build list failed to load, and lists the rest", async () => {
			const { values } = await optionsOf(
				{
					SERVER_TYPE: "paper",
				},
				{
					...PAPER_PROJECT_ANSWER,
					[buildsUrlOf("26.3")]: buildsOf("BETA"),
					[buildsUrlOf("26.2")]: new BridgeNetError(503, "fill.papermc.io answered 503"),
					[buildsUrlOf("1.21.11")]: buildsOf("STABLE"),
				},
			);

			expect(values).toEqual([
				"26.2",
				"1.21.11",
			]);
		});

		it("reads every version's build list", async () => {
			const { asked } = await optionsOf(
				{
					SERVER_TYPE: "paper",
				},
				PAPER_PROJECT_ANSWER,
			);

			expect(asked.filter((url) => url.endsWith("/builds")).sort()).toEqual(
				[
					buildsUrlOf("26.3"),
					buildsUrlOf("26.2"),
					buildsUrlOf("1.21.11"),
					buildsUrlOf("1.21.10"),
				].sort(),
			);
		});
	});

	describe("the NeoForge version picker", () => {
		it("lists a version only when it has a build that is not a beta", async () => {
			const { values } = await optionsOf(
				{
					SERVER_TYPE: "neoforge",
				},
				{
					"https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml":
						"<version>21.1.80</version><version>26.3.0.1-beta</version>",
					"https://piston-meta.mojang.com/mc/game/version_manifest_v2.json": {
						latest: {
							release: "26.3",
						},
						versions: [
							{
								id: "26.3",
								type: "release",
								url: "",
							},
							{
								id: "1.21.1",
								type: "release",
								url: "",
							},
						],
					},
				},
			);

			expect(values).toEqual([
				"1.21.1",
			]);
		});
	});
});
