import { type Bridge, BridgeUserError } from "@serverkgg/bridge";

export const DIFFICULTIES: readonly string[] = [
	"peaceful",
	"easy",
	"normal",
	"hard",
];

export const GAME_MODES: readonly string[] = [
	"survival",
	"creative",
	"adventure",
	"spectator",
];

export const GAME_MODE_OPTIONS: Bridge.Option[] = [
	{
		value: "survival",
		label: {
			ar: "البقاء",
			en: "Survival",
		},
	},
	{
		value: "creative",
		label: {
			ar: "الإبداع",
			en: "Creative",
		},
	},
	{
		value: "adventure",
		label: {
			ar: "المغامرة",
			en: "Adventure",
		},
	},
	{
		value: "spectator",
		label: {
			ar: "المشاهدة",
			en: "Spectator",
		},
	},
];

export const DIFFICULTY_OPTIONS: Bridge.Option[] = [
	{
		value: "peaceful",
		label: {
			ar: "مسالم",
			en: "Peaceful",
		},
	},
	{
		value: "easy",
		label: {
			ar: "سهل",
			en: "Easy",
		},
	},
	{
		value: "normal",
		label: {
			ar: "عادي",
			en: "Normal",
		},
	},
	{
		value: "hard",
		label: {
			ar: "صعب",
			en: "Hard",
		},
	},
];

export const XP_MIN_LEVELS = 1;

export const XP_MAX_LEVELS = 100;

export const choiceArgument = (args: Bridge.Values, key: string, choices: readonly string[]) => {
	const value = String(args[key] ?? "");

	if (!choices.includes(value)) {
		throw new BridgeUserError({
			ar: `الخيار المحدد غير معروف، اختر واحدًا من: ${choices.join("، ")}.`,
			en: `"${value}" isn't one of ${choices.join(", ")}.`,
		});
	}

	return value;
};

export const levelsArgument = (args: Bridge.Values) => {
	const levels = Number(args.amount ?? Number.NaN);

	if (!Number.isInteger(levels) || levels < XP_MIN_LEVELS || levels > XP_MAX_LEVELS) {
		throw new BridgeUserError({
			ar: `اكتب عددًا صحيحًا بين ${XP_MIN_LEVELS} و ${XP_MAX_LEVELS}.`,
			en: `Enter a whole number between ${XP_MIN_LEVELS} and ${XP_MAX_LEVELS}.`,
		});
	}

	return levels;
};

export const optionLabel = (options: readonly Bridge.Option[], value: string): Bridge.Text => {
	return (
		options.find((option) => option.value === value)?.label ?? {
			ar: value,
			en: value,
		}
	);
};
