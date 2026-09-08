import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { choiceArgument, GAME_MODES, levelsArgument } from "../shared";

const LIST_REPLY = /There are \d+ of a max of \d+ players online:(?<names>.*)$/;

const BEDROCK_PREFIX = ".";

export const playerPresence = (name: string) => {
	return {
		player: name,
		skin: name.startsWith(BEDROCK_PREFIX) ? name.slice(BEDROCK_PREFIX.length) : name,
		platform: name.startsWith(BEDROCK_PREFIX) ? "bedrock" : "java",
	};
};

export const players: Bridge.Collection = {
	kind: BridgeKind.Collection,
	requiresRunning: true,
	refreshSeconds: 15,
	async list(context) {
		const reply = await context.command("list", {
			expect: LIST_REPLY,
		});

		return (reply.groups.names ?? "")
			.split(",")
			.map((name) => name.trim())
			.filter((name) => name.length > 0)
			.map((name) => {
				return {
					id: name,
					name,
				};
			});
	},
	actions: {
		async kick(context, row) {
			await context.command(`kick ${row.id}`);

			context.emit(BridgeEventName.PlayerKicked, playerPresence(row.id));
		},
		async ban(context, row) {
			await context.command(`ban ${row.id}`);

			context.emit(BridgeEventName.PlayerBanned, playerPresence(row.id));
		},
		async op(context, row) {
			await context.command(`op ${row.id}`);
		},
		async kill(context, row) {
			await context.command(`kill ${row.id}`);
		},
		async xp(context, row, args) {
			await context.command(`xp add ${row.id} ${levelsArgument(args)} levels`);
		},
		async gamemode(context, row, args) {
			await context.command(`gamemode ${choiceArgument(args, "mode", GAME_MODES)} ${row.id}`);
		},
	},
};
