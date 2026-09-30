import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { choiceArgument, GAME_MODE_OPTIONS, GAME_MODES, levelsArgument, optionLabel } from "../shared";

const LIST_REPLY = /There are \d+ of a max of \d+ players online:(?<names>.*)$/;

const BEDROCK_PREFIX = ".";

const OPERATORS_LIST = "operators";

const levelsText = (amount: number) => {
	if (amount === 1) {
		return "مستوى واحد";
	}

	if (amount === 2) {
		return "مستويين";
	}

	return amount <= 10 ? `${amount} مستويات` : `${amount} مستوى`;
};

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
			context.activity.report({
				name: BridgeEventName.PlayerKicked,
				text: {
					ar: `تم طرد ${row.id}`,
					en: `Kicked ${row.id}`,
				},
				subject: row.id,
				details: playerPresence(row.id),
			});
		},
		async ban(context, row) {
			await context.command(`ban ${row.id}`);

			context.emit(BridgeEventName.PlayerBanned, playerPresence(row.id));
			context.activity.report({
				name: BridgeEventName.PlayerBanned,
				text: {
					ar: `تم حظر ${row.id}`,
					en: `Banned ${row.id}`,
				},
				subject: row.id,
				details: playerPresence(row.id),
			});
		},
		async op(context, row) {
			await context.command(`op ${row.id}`);

			context.activity.report({
				name: BridgeEventName.AccessGranted,
				text: {
					ar: `تمت إضافة ${row.id} لقائمة الأدمن`,
					en: `Added ${row.id} to the operator list`,
				},
				subject: row.id,
				details: {
					...playerPresence(row.id),
					list: OPERATORS_LIST,
				},
			});
		},
		async kill(context, row) {
			await context.command(`kill ${row.id}`);

			context.activity.report({
				name: BridgeEventName.PlayerChanged,
				text: {
					ar: `تم قتل ${row.id} داخل اللعبة`,
					en: `Killed ${row.id} in game`,
				},
				subject: row.id,
				details: {
					...playerPresence(row.id),
					change: "kill",
				},
			});
		},
		async xp(context, row, args) {
			const amount = levelsArgument(args);

			await context.command(`xp add ${row.id} ${amount} levels`);

			context.activity.report({
				name: BridgeEventName.PlayerChanged,
				text: {
					ar: `تمت زيادة خبرة ${row.id} ${levelsText(amount)}`,
					en: `Gave ${row.id} ${amount} ${amount === 1 ? "level" : "levels"} of experience`,
				},
				subject: row.id,
				details: {
					...playerPresence(row.id),
					change: "xp",
					amount,
				},
			});
		},
		async gamemode(context, row, args) {
			const mode = choiceArgument(args, "mode", GAME_MODES);
			const label = optionLabel(GAME_MODE_OPTIONS, mode);

			await context.command(`gamemode ${mode} ${row.id}`);

			context.activity.report({
				name: BridgeEventName.PlayerChanged,
				text: {
					ar: `تم تغيير نمط اللعب لـ ${row.id} إلى ${label.ar}`,
					en: `Set ${row.id}'s game mode to ${label.en}`,
				},
				subject: row.id,
				details: {
					...playerPresence(row.id),
					change: "gamemode",
					mode,
				},
			});
		},
	},
};
