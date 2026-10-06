import { describe, expect, it } from "bun:test";
import { type Bridge, BridgeNetError } from "@serverkgg/bridge";
import { loaderBuild } from "./loaderBuildOptions";

const FORGE_METADATA_URL = "https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml";

const FORGE_PROMOTIONS_URL = "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json";

const FORGE_ANSWERS: Record<string, unknown> = {
	[FORGE_METADATA_URL]: [
		"1.20.1-47.2.0",
		"1.20.1-47.4.0",
	]
		.map((version) => `<version>${version}</version>`)
		.join(""),
	[FORGE_PROMOTIONS_URL]: {
		promos: {
			"1.20.1-recommended": "47.4.0",
		},
	},
};

const stampOf = (build: string) => {
	return JSON.stringify({
		variant: "forge",
		version: "1.20.1",
		build,
		java: 17,
		launch: {
			kind: "args",
			target: `libraries/net/minecraftforge/forge/1.20.1-${build}/unix_args.txt`,
		},
		rconPassword: null,
		rconPasswordNext: null,
	});
};

const optionsOf = async (variables: Record<string, string>, stamp: string | null) => {
	const answer = (url: string) => {
		const value = FORGE_ANSWERS[url];

		if (value === undefined) {
			throw new BridgeNetError(404, `${url} answered 404`);
		}

		return value;
	};

	const context = {
		variable: (key: string) => variables[key] ?? null,
		files: {
			exists: async (path: string) => stamp !== null && path === ".serverk-install.json",
			read: async () => stamp ?? "",
		},
		net: {
			json: async (url: string) => answer(url),
			text: async (url: string) => answer(url),
		},
	} as unknown as Bridge.Context;

	return await loaderBuild.list(context);
};

describe("loaderBuild", () => {
	it("lists the installed Forge build beside the recommended one, so the select always holds its value", async () => {
		const options = await optionsOf(
			{
				SERVER_TYPE: "forge",
				MC_VERSION: "1.20.1",
				LOADER_VERSION: "47.2.0",
			},
			stampOf("47.2.0"),
		);

		expect(options).toEqual([
			{
				value: "47.4.0",
				label: {
					ar: "47.4.0 (موصى به)",
					en: "47.4.0 (recommended)",
				},
				latest: true,
			},
			{
				value: "47.2.0",
				label: {
					ar: "47.2.0 (مثبّت حاليًا)",
					en: "47.2.0 (installed)",
				},
			},
		]);
	});

	it("lists only the recommended build when that is the one installed", async () => {
		const options = await optionsOf(
			{
				SERVER_TYPE: "forge",
				MC_VERSION: "1.20.1",
				LOADER_VERSION: "47.4.0",
			},
			stampOf("47.4.0"),
		);

		expect(options.map((option) => option.value)).toEqual([
			"47.4.0",
		]);
	});

	it("leaves out a pinned build Forge does not publish", async () => {
		const options = await optionsOf(
			{
				SERVER_TYPE: "forge",
				MC_VERSION: "1.20.1",
				LOADER_VERSION: "47.9.9",
			},
			null,
		);

		expect(options.map((option) => option.value)).toEqual([
			"47.4.0",
		]);
	});

	it("lists a pinned build that is published but not installed under its plain name", async () => {
		const options = await optionsOf(
			{
				SERVER_TYPE: "forge",
				MC_VERSION: "1.20.1",
				LOADER_VERSION: "47.2.0",
			},
			null,
		);

		expect(options.at(1)).toEqual({
			value: "47.2.0",
			label: {
				ar: "47.2.0",
				en: "47.2.0",
			},
		});
	});
});
