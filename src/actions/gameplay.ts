import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { choiceArgument, DIFFICULTIES, DIFFICULTY_OPTIONS, optionLabel } from "../shared";
import { activeWorld, readWorldHardcore } from "../worlds";

const HARDCORE_DIFFICULTY: Bridge.Text = {
	ar: "الهاردكور مفعّل في هذا الماب، لذلك تبقى الصعوبة على «صعب». لتغييرها وقّف السيرفر، ثم أوقف الهاردكور من تبويب المابات.",
	en: "Hardcore is on for this world, so the difficulty stays on Hard. To change it, stop the server, then turn hardcore off in the Worlds tab.",
};

const activeWorldHardcore = async (context: Bridge.Context) => {
	try {
		return await readWorldHardcore(context, await activeWorld(context));
	} catch (error) {
		context.log.warn("could not read whether the active world is hardcore", {
			reason: error instanceof Error ? error.message : String(error),
		});

		return null;
	}
};

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

			if ((await activeWorldHardcore(context)) === true) {
				throw new BridgeUserError(HARDCORE_DIFFICULTY);
			}

			await context.command(`difficulty ${mode}`);

			reportGameplay(context, "difficulty", mode, {
				ar: `تم تغيير الصعوبة إلى ${label.ar}`,
				en: `Set the difficulty to ${label.en}`,
			});
		},
	},
};
