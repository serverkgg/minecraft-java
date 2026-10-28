import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { type InstallStamp, LaunchKind } from "../install";
import { ServerVariant } from "../shared";
import { applyGameRules, applyStoredGameRules, changedFlags, gameRuleCommands, gameRulesFor } from "./gameRules";
import { settings } from "./settings";

const CAMEL_RULES = {
	pvp: "pvp",
	"enable-command-block": "commandBlocksEnabled",
};

const REGISTRY_RULES = {
	pvp: "pvp",
	"enable-command-block": "command_blocks_work",
};

const stampText = (version: string, variant: ServerVariant) => {
	const stamp: InstallStamp = {
		variant,
		version,
		build: null,
		java: 21,
		launch: {
			kind: LaunchKind.Jar,
			target: "server.jar",
		},
		rconPassword: null,
		rconPasswordNext: null,
		launchDigest: null,
	};

	return JSON.stringify(stamp);
};

interface FakeServer {
	version: string | null;
	variant?: ServerVariant;
	running: boolean;
	properties: Bridge.Values;
}

const fakeServer = (options: FakeServer) => {
	const sent: string[] = [];
	const properties: Bridge.Values = {
		...options.properties,
	};
	const context = {
		server: {
			running: options.running,
		},
		files: {
			exists: async () => options.version !== null,
			read: async () =>
				options.version === null ? "" : stampText(options.version, options.variant ?? ServerVariant.Vanilla),
		},
		codec: {
			javaProperties: {
				read: async () => ({
					...properties,
				}),
				merge: async (_path: string, values: Bridge.Values) => {
					for (const [key, value] of Object.entries(values)) {
						properties[key] = String(value);
					}
				},
			},
		},
		command: async (input: string) => {
			sent.push(input);

			return {
				sent: input,
				line: null,
				groups: {},
			};
		},
		log: Object.assign(() => undefined, {
			warn: () => undefined,
			error: () => undefined,
		}),
	} as unknown as Bridge.Context;

	return {
		context,
		sent,
		properties,
	};
};

describe("which versions read pvp and command blocks as game rules", () => {
	it("1.21.8 and older still read them from server.properties", () => {
		expect(gameRulesFor("1.21.8")).toBeNull();
		expect(gameRulesFor("1.20.4")).toBeNull();
		expect(gameRulesFor("1.8.9")).toBeNull();
		expect(gameRulesFor("1.21")).toBeNull();
	});

	it("1.21.9 and 1.21.10 name the command block rule commandBlocksEnabled", () => {
		expect(gameRulesFor("1.21.9")).toEqual(CAMEL_RULES);
		expect(gameRulesFor("1.21.10")).toEqual(CAMEL_RULES);
	});

	it("1.21.11 and every later release name it command_blocks_work", () => {
		expect(gameRulesFor("1.21.11")).toEqual(REGISTRY_RULES);
		expect(gameRulesFor("26.1")).toEqual(REGISTRY_RULES);
		expect(gameRulesFor("26.1.2")).toEqual(REGISTRY_RULES);
		expect(gameRulesFor("26.3")).toEqual(REGISTRY_RULES);
	});

	it("a pre-release, release candidate or numbered snapshot follows the release it leads to", () => {
		expect(gameRulesFor("1.21.9-pre1")).toEqual(CAMEL_RULES);
		expect(gameRulesFor("1.21.10-rc1")).toEqual(CAMEL_RULES);
		expect(gameRulesFor("1.21.11-pre3")).toEqual(REGISTRY_RULES);
		expect(gameRulesFor("26.3-rc-1")).toEqual(REGISTRY_RULES);
		expect(gameRulesFor("26.4-snapshot-3")).toEqual(REGISTRY_RULES);
		expect(gameRulesFor("1.21.8-rc1")).toBeNull();
	});

	it("a version id it cannot read keeps the server.properties behaviour", () => {
		expect(gameRulesFor("25w35a")).toBeNull();
		expect(gameRulesFor("")).toBeNull();
	});
});

describe("the gamerule commands a set of values becomes", () => {
	it("each rule-backed boolean becomes one gamerule command", () => {
		expect(
			gameRuleCommands(
				REGISTRY_RULES,
				{
					pvp: "false",
					"enable-command-block": true,
					motd: "hello",
				},
				false,
			),
		).toEqual([
			"gamerule pvp false",
			"gamerule command_blocks_work true",
		]);
	});

	it("a missing or unreadable value sends nothing", () => {
		expect(
			gameRuleCommands(
				CAMEL_RULES,
				{
					pvp: "",
					"enable-command-block": "maybe",
				},
				false,
			),
		).toEqual([]);
	});

	it("a server with one game rule set per world also sets it in the nether and the end", () => {
		expect(
			gameRuleCommands(
				REGISTRY_RULES,
				{
					pvp: "false",
				},
				true,
			),
		).toEqual([
			"gamerule pvp false",
			"execute in minecraft:the_nether run gamerule pvp false",
			"execute in minecraft:the_end run gamerule pvp false",
		]);
	});

	it("only a flag that changed counts as changed", () => {
		expect(
			changedFlags(
				{
					pvp: "true",
					"enable-command-block": "false",
				},
				{
					pvp: true,
					"enable-command-block": true,
					motd: "x",
				},
			),
		).toEqual({
			"enable-command-block": true,
		});
	});
});

describe("applying pvp and command blocks to a server", () => {
	it("a 1.21.11 server gets the stored values as game rules once it is ready", async () => {
		const { context, sent } = fakeServer({
			version: "1.21.11",
			running: true,
			properties: {
				pvp: "false",
				"enable-command-block": "false",
			},
		});

		await applyStoredGameRules(context);

		expect(sent).toEqual([
			"gamerule pvp false",
			"gamerule command_blocks_work false",
		]);
	});

	it("a 1.21.10 server gets the camel case command block rule", async () => {
		const { context, sent } = fakeServer({
			version: "1.21.10",
			running: true,
			properties: {
				pvp: "true",
				"enable-command-block": "true",
			},
		});

		await applyStoredGameRules(context);

		expect(sent).toEqual([
			"gamerule pvp true",
			"gamerule commandBlocksEnabled true",
		]);
	});

	it("a paper or purpur server sets each rule in every world it keeps, through the vanilla commands", async () => {
		for (const variant of [
			ServerVariant.Paper,
			ServerVariant.Purpur,
		]) {
			const { context, sent } = fakeServer({
				version: "1.21.11",
				variant,
				running: true,
				properties: {
					"enable-command-block": "false",
				},
			});

			await applyStoredGameRules(context);

			expect(sent).toEqual([
				"minecraft:gamerule command_blocks_work false",
				"minecraft:execute in minecraft:the_nether run gamerule command_blocks_work false",
				"minecraft:execute in minecraft:the_end run gamerule command_blocks_work false",
			]);
		}
	});

	it("a paper 1.21.8 server sends no command", async () => {
		const { context, sent } = fakeServer({
			version: "1.21.8",
			variant: ServerVariant.Paper,
			running: true,
			properties: {
				pvp: "false",
			},
		});

		await applyStoredGameRules(context);

		expect(sent).toEqual([]);
	});

	it("a 1.21.8 server sends no command, the game reads server.properties itself", async () => {
		const { context, sent } = fakeServer({
			version: "1.21.8",
			running: true,
			properties: {
				pvp: "false",
				"enable-command-block": "true",
			},
		});

		await applyStoredGameRules(context);

		expect(sent).toEqual([]);
	});

	it("a server with no install stamp sends no command", async () => {
		const { context, sent } = fakeServer({
			version: null,
			running: true,
			properties: {
				pvp: "false",
			},
		});

		await applyGameRules(context, {
			pvp: "false",
		});

		expect(sent).toEqual([]);
	});

	it("saving the settings form on a running 1.21.11 server applies only the rule that changed", async () => {
		const { context, sent, properties } = fakeServer({
			version: "1.21.11",
			running: true,
			properties: {
				pvp: "true",
				"enable-command-block": "false",
			},
		});

		await settings.write?.(context, {
			pvp: false,
			"enable-command-block": false,
			motd: "hi",
		});

		expect(properties.pvp).toBe("false");
		expect(sent).toEqual([
			"gamerule pvp false",
		]);
	});

	it("saving the settings form on a stopped server only writes server.properties", async () => {
		const { context, sent, properties } = fakeServer({
			version: "1.21.11",
			running: false,
			properties: {
				pvp: "true",
			},
		});

		await settings.write?.(context, {
			pvp: false,
		});

		expect(properties.pvp).toBe("false");
		expect(sent).toEqual([]);
	});

	it("saving the settings form on a running 1.21.8 server only writes server.properties", async () => {
		const { context, sent, properties } = fakeServer({
			version: "1.21.8",
			running: true,
			properties: {
				pvp: "true",
			},
		});

		await settings.write?.(context, {
			pvp: false,
		});

		expect(properties.pvp).toBe("false");
		expect(sent).toEqual([]);
	});
});
