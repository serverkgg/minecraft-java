import type { Bridge } from "@serverkgg/bridge";
import { readInstallStamp } from "../install";
import { PLUGIN_VARIANTS } from "../shared";

export const PROPERTIES_FILE = "server.properties";

type VersionParts = readonly [
	number,
	number,
	number,
];

const RELEASE_PATTERN = /^(\d+)\.(\d+)(?:\.(\d+))?(?:-|$)/;

const CAMEL_RULES_SINCE: VersionParts = [
	1,
	21,
	9,
];

const REGISTRY_RULES_SINCE: VersionParts = [
	1,
	21,
	11,
];

const PER_WORLD_DIMENSIONS = [
	"minecraft:the_nether",
	"minecraft:the_end",
];

interface PropertyRule {
	camel: string;
	registry: string;
}

const PROPERTY_GAME_RULES: Readonly<Record<string, PropertyRule>> = {
	pvp: {
		camel: "pvp",
		registry: "pvp",
	},
	"enable-command-block": {
		camel: "commandBlocksEnabled",
		registry: "command_blocks_work",
	},
};

const versionParts = (version: string): VersionParts | null => {
	const match = RELEASE_PATTERN.exec(version);

	if (!match) {
		return null;
	}

	return [
		Number(match[1]),
		Number(match[2]),
		Number(match[3] ?? 0),
	];
};

const atLeast = (parts: VersionParts, floor: VersionParts) => {
	for (let index = 0; index < floor.length; index += 1) {
		const left = parts[index] ?? 0;
		const right = floor[index] ?? 0;

		if (left !== right) {
			return left > right;
		}
	}

	return true;
};

export const gameRulesFor = (version: string): Record<string, string> | null => {
	const parts = versionParts(version);

	if (!parts || !atLeast(parts, CAMEL_RULES_SINCE)) {
		return null;
	}

	const registry = atLeast(parts, REGISTRY_RULES_SINCE);
	const rules: Record<string, string> = {};

	for (const [key, rule] of Object.entries(PROPERTY_GAME_RULES)) {
		rules[key] = registry ? rule.registry : rule.camel;
	}

	return rules;
};

const flagOf = (value: Bridge.Value | undefined) => {
	const text = String(value ?? "")
		.trim()
		.toLowerCase();

	return text === "true" || text === "false" ? text : null;
};

export const gameRuleCommands = (rules: Record<string, string>, values: Bridge.Values, perWorld: boolean) => {
	const commands: string[] = [];

	for (const [key, rule] of Object.entries(rules)) {
		const flag = flagOf(values[key]);

		if (flag === null) {
			continue;
		}

		const command = `gamerule ${rule} ${flag}`;

		commands.push(command);

		if (perWorld) {
			for (const dimension of PER_WORLD_DIMENSIONS) {
				commands.push(`execute in ${dimension} run ${command}`);
			}
		}
	}

	return commands;
};

export const changedFlags = (before: Bridge.Values, after: Bridge.Values): Bridge.Values => {
	const changed: Bridge.Values = {};

	for (const [key, value] of Object.entries(after)) {
		if (flagOf(value) !== flagOf(before[key])) {
			changed[key] = value;
		}
	}

	return changed;
};

export const applyGameRules = async (context: Bridge.Context, values: Bridge.Values) => {
	const stamp = await readInstallStamp(context);
	const rules = stamp ? gameRulesFor(stamp.version) : null;

	if (!stamp || !rules) {
		return;
	}

	for (const command of gameRuleCommands(rules, values, PLUGIN_VARIANTS.includes(stamp.variant))) {
		await context.command(command);
		context.log("applied a server property as a game rule", {
			command,
			version: stamp.version,
		});
	}
};

export const applyStoredGameRules = async (context: Bridge.Context) => {
	await applyGameRules(context, await context.codec.javaProperties.read(PROPERTIES_FILE));
};
