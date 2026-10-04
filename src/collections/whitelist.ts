import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { crossplayEnabled, FLOODGATE_PREFIX } from "../companions";

const WHITELIST_FILE = "whitelist.json";

interface WhitelistEntry {
	name?: unknown;
}

const WHITELIST_LIST = "whitelist";

const isBedrockName = (input: string) => {
	return input.startsWith(FLOODGATE_PREFIX) || input.includes(" ");
};

const whitelistDetails = (name: string, bedrock: boolean): Bridge.Values => {
	return {
		list: WHITELIST_LIST,
		player: name,
		platform: bedrock ? "bedrock" : "java",
	};
};

const reportAdded = (context: Bridge.Context, name: string, bedrock: boolean) => {
	context.activity.report({
		name: BridgeEventName.AccessGranted,
		text: {
			ar: `تمت إضافة ${name} إلى القائمة البيضاء`,
			en: `Added ${name} to the whitelist`,
		},
		subject: name,
		details: whitelistDetails(name, bedrock),
	});
};

const reportRemoved = (context: Bridge.Context, name: string, bedrock: boolean) => {
	context.activity.report({
		name: BridgeEventName.AccessRevoked,
		text: {
			ar: `تمت إزالة ${name} من القائمة البيضاء`,
			en: `Removed ${name} from the whitelist`,
		},
		subject: name,
		details: whitelistDetails(name, bedrock),
	});
};

export const whitelist: Bridge.Collection = {
	kind: BridgeKind.Collection,
	async list(context) {
		if (!(await context.files.exists(WHITELIST_FILE))) {
			return [];
		}

		const parsed: unknown = JSON.parse(await context.files.read(WHITELIST_FILE));

		if (!Array.isArray(parsed)) {
			return [];
		}

		return parsed
			.map((entry: unknown) => {
				const name = (entry as WhitelistEntry).name;

				return typeof name === "string" ? name : null;
			})
			.filter((name): name is string => name !== null)
			.map((name) => {
				return {
					id: name,
					name,
				};
			});
	},
	async add(context, input) {
		const name = input.trim();

		if (crossplayEnabled(context) && isBedrockName(name)) {
			await context.command(`fwhitelist add ${JSON.stringify(name)}`);

			reportAdded(context, name, true);

			return;
		}

		await context.command(`whitelist add ${name}`);

		reportAdded(context, name, false);
	},
	actions: {
		async remove(context, row) {
			if (crossplayEnabled(context) && isBedrockName(row.id)) {
				await context.command(`fwhitelist remove ${JSON.stringify(row.id)}`);

				reportRemoved(context, row.id, true);

				return;
			}

			await context.command(`whitelist remove ${row.id}`);

			reportRemoved(context, row.id, false);
		},
	},
};
