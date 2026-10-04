import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { choiceArgument, DIFFICULTIES, DIFFICULTY_OPTIONS, optionLabel } from "../shared";

const reportGameplay = (context: Bridge.Context, what: string, value: string, text: Bridge.Text) => {
	context.activity.report({
		name: BridgeEventName.GameplayChanged,
		text,
		subject: what,
		details: {
			what,
			value,
		},
	});
};

export const gameplay: Bridge.Actions = {
	kind: BridgeKind.Actions,
	requiresRunning: true,
	actions: {
		async timeDay(context) {
			await context.command("time set day");

			reportGameplay(context, "time", "day", {
				ar: "تم تحويل الوقت إلى النهار",
				en: "Set the time to day",
			});
		},

		async timeNight(context) {
			await context.command("time set night");

			reportGameplay(context, "time", "night", {
				ar: "تم تحويل الوقت إلى الليل",
				en: "Set the time to night",
			});
		},

		async weatherClear(context) {
			await context.command("weather clear");

			reportGameplay(context, "weather", "clear", {
				ar: "تم تغيير الطقس إلى صافٍ",
				en: "Set the weather to clear",
			});
		},

		async weatherRain(context) {
			await context.command("weather rain");

			reportGameplay(context, "weather", "rain", {
				ar: "تم تغيير الطقس إلى مطر",
				en: "Set the weather to rain",
			});
		},

		async weatherThunder(context) {
			await context.command("weather thunder");

			reportGameplay(context, "weather", "thunder", {
				ar: "تم تغيير الطقس إلى رعد وبرق",
				en: "Set the weather to thunder",
			});
		},

		async saveAll(context) {
			await context.command("save-all");

			reportGameplay(context, "save", "all", {
				ar: "تم حفظ الماب",
				en: "Saved the world",
			});
		},

		async difficulty(context, args) {
			const mode = choiceArgument(args, "mode", DIFFICULTIES);
			const label = optionLabel(DIFFICULTY_OPTIONS, mode);

			await context.command(`difficulty ${mode}`);

			reportGameplay(context, "difficulty", mode, {
				ar: `تم تغيير الصعوبة إلى ${label.ar}`,
				en: `Set the difficulty to ${label.en}`,
			});
		},
	},
};
