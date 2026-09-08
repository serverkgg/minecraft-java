import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { parseBanList } from "../shared";

const BANLIST_COMMAND = "banlist players";

const BANLIST_REPLY = /There are (?:(?<count>\d+) ban(?:s|\(s\)):|no bans)/;

const TAIL_MARGIN = 8;

const POLL_INTERVAL_MS = 100;

const POLL_TIMEOUT_MS = 2000;

const printedBans = async (context: Bridge.Context, count: number) => {
	const deadline = Date.now() + POLL_TIMEOUT_MS;

	for (;;) {
		const printed = await context.logs.tail(count + TAIL_MARGIN);
		const entries = parseBanList(printed.join("\n"));

		if (entries.length >= count || Date.now() >= deadline) {
			return entries;
		}

		await Bun.sleep(POLL_INTERVAL_MS);
	}
};

export const bans: Bridge.Collection = {
	kind: BridgeKind.Collection,
	requiresRunning: true,
	async list(context) {
		const reply = await context.command(BANLIST_COMMAND, {
			expect: BANLIST_REPLY,
		});

		const count = Number(reply.groups.count ?? "0");

		if (count === 0) {
			return [];
		}

		return (await printedBans(context, count)).map((entry) => {
			return {
				id: entry.name,
				name: entry.name,
				source: entry.source,
				reason: entry.reason,
			};
		});
	},
	actions: {
		async remove(context, row) {
			await context.command(`pardon ${row.id}`);
		},
	},
};
