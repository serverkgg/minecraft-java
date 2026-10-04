import { type Bridge, BridgeKind, BridgeStream, BridgeTerminalLevel } from "@serverkgg/bridge";

const player: Bridge.TerminalArg = {
	key: "player",
	label: {
		ar: "اللاعب",
		en: "Player",
	},
	required: true,
	module: "players",
	column: "name",
};

const commands: Bridge.TerminalCommand[] = [
	{
		name: "say",
		summary: {
			ar: "رسالة تظهر لكل اللاعبين.",
			en: "Broadcast a message to everyone.",
		},
		syntax: "say <message>",
	},
	{
		name: "list",
		summary: {
			ar: "يعرض اللاعبين المتصلين حاليًا.",
			en: "List the players who are online.",
		},
	},
	{
		name: "save-all",
		summary: {
			ar: "يحفظ الماب على القرص.",
			en: "Save the world to disk.",
		},
	},
	{
		name: "kick",
		summary: {
			ar: "يطرد لاعبًا من السيرفر.",
			en: "Kick a player from the server.",
		},
		syntax: "kick <player> [reason]",
		args: [
			player,
		],
	},
	{
		name: "ban",
		summary: {
			ar: "يحظر لاعبًا نهائيًا.",
			en: "Ban a player.",
		},
		syntax: "ban <player> [reason]",
		args: [
			player,
		],
		danger: true,
	},
	{
		name: "pardon",
		summary: {
			ar: "يفك الحظر عن لاعب.",
			en: "Lift a ban.",
		},
		syntax: "pardon <player>",
	},
	{
		name: "op",
		summary: {
			ar: "يجعل لاعبًا أدمن.",
			en: "Make a player an operator.",
		},
		syntax: "op <player>",
		args: [
			player,
		],
		danger: true,
	},
	{
		name: "deop",
		summary: {
			ar: "يسحب صلاحية الأدمن.",
			en: "Remove a player's operator rights.",
		},
		syntax: "deop <player>",
		args: [
			player,
		],
	},
	{
		name: "whitelist",
		summary: {
			ar: "يدير القائمة البيضاء.",
			en: "Manage the whitelist.",
		},
		syntax: "whitelist <action> [player]",
		args: [
			{
				key: "action",
				required: true,
				values: [
					"add",
					"remove",
					"list",
					"on",
					"off",
					"reload",
				],
			},
			{
				key: "player",
				module: "whitelist",
				column: "name",
			},
		],
	},
	{
		name: "gamemode",
		summary: {
			ar: "يغيّر وضع اللعب للاعب.",
			en: "Change a player's game mode.",
		},
		syntax: "gamemode <mode> [player]",
		args: [
			{
				key: "mode",
				required: true,
				values: [
					"survival",
					"creative",
					"adventure",
					"spectator",
				],
			},
			{
				...player,
				required: false,
			},
		],
	},
	{
		name: "difficulty",
		summary: {
			ar: "يغيّر صعوبة الماب.",
			en: "Change the world difficulty.",
		},
		syntax: "difficulty <level>",
		args: [
			{
				key: "level",
				required: true,
				values: [
					"peaceful",
					"easy",
					"normal",
					"hard",
				],
			},
		],
	},
	{
		name: "time",
		summary: {
			ar: "يضبط الوقت في الماب.",
			en: "Set the world time.",
		},
		syntax: "time set <value>",
		args: [
			{
				key: "action",
				required: true,
				values: [
					"set",
					"add",
					"query",
				],
			},
			{
				key: "value",
				values: [
					"day",
					"noon",
					"night",
					"midnight",
				],
			},
		],
	},
	{
		name: "weather",
		summary: {
			ar: "يغيّر الطقس.",
			en: "Change the weather.",
		},
		syntax: "weather <kind>",
		args: [
			{
				key: "kind",
				required: true,
				values: [
					"clear",
					"rain",
					"thunder",
				],
			},
		],
	},
	{
		name: "tp",
		summary: {
			ar: "ينقل لاعبًا إلى مكان لاعب آخر.",
			en: "Teleport one player to another.",
		},
		syntax: "tp <player> <target>",
		args: [
			player,
			{
				...player,
				key: "target",
			},
		],
	},
	{
		name: "give",
		summary: {
			ar: "يعطي لاعبًا غرضًا.",
			en: "Give a player an item.",
		},
		syntax: "give <player> <item> [count]",
		args: [
			player,
			{
				key: "item",
				required: true,
			},
			{
				key: "count",
			},
		],
	},
	{
		name: "xp",
		summary: {
			ar: "يضيف خبرة للاعب.",
			en: "Grant experience to a player.",
		},
		syntax: "xp add <player> <amount>",
	},
	{
		name: "seed",
		summary: {
			ar: "يعرض السيد الخاص بالماب.",
			en: "Show the world seed.",
		},
	},
	{
		name: "stop",
		summary: {
			ar: "يوقف السيرفر بأمان.",
			en: "Stop the server safely.",
		},
		danger: true,
	},
];

const rules: Bridge.TerminalRule[] = [
	{
		match: /\[[^\]]*\/(?:ERROR|FATAL)\]/,
		level: BridgeTerminalLevel.Error,
	},
	{
		match: /^\s*at [\w.$]+\(/,
		level: BridgeTerminalLevel.Error,
	},
	{
		match: /^(?:Caused by|Exception in thread)\b/,
		level: BridgeTerminalLevel.Error,
	},
	{
		match: /\[[^\]]*\/WARN\]/,
		level: BridgeTerminalLevel.Warn,
	},
	{
		match: /java\.lang\.OutOfMemoryError/,
		level: BridgeTerminalLevel.Error,
		stream: BridgeStream.Stderr,
	},
];

export const terminal: Bridge.Terminal = {
	kind: BridgeKind.Terminal,
	commands,
	rules,
};
