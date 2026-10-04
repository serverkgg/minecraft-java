import { type Bridge, BridgeKind, BridgeSetupStepKind } from "@serverkgg/bridge";
import { GuideOpenTab } from "@serverkgg/bridge/guides";

export const VERSION_TAB = "version";

export const VERSION_SECTION = "version";

export const SETTINGS_TAB = "settings";

export const SETTINGS_SECTION = "settings";

export const VERSION_STEP = "version";

export const NAME_STEP = "name";

export const INVITE_STEP = "invite";

export const setup: Bridge.Setup = {
	kind: BridgeKind.Setup,
	steps: [
		{
			kind: BridgeSetupStepKind.Form,
			id: VERSION_STEP,
			required: false,
			tab: VERSION_TAB,
			section: VERSION_SECTION,
			title: {
				ar: "اختر الإصدار",
				en: "Pick your version",
			},
			help: {
				ar: "نوع السيرفر وإصدار ماينكرافت. تغييرهما يعيد التثبيت، لذلك اختر الآن إذا أردت إضافات أو مودات، أو تخطَّ هذه الخطوة لتبقى على أحدث إصدار.",
				en: "The server type and Minecraft version. Changing them reinstalls, so choose now if you want plugins or mods. Skip it to stay on the latest.",
			},
		},
		{
			kind: BridgeSetupStepKind.Form,
			id: NAME_STEP,
			required: false,
			tab: SETTINGS_TAB,
			section: SETTINGS_SECTION,
			fields: [
				"motd",
				"max-players",
			],
			title: {
				ar: "سمّ سيرفرك",
				en: "Name your server",
			},
			help: {
				ar: "الرسالة التي تظهر في قائمة السيرفرات وعدد اللاعبين. عدّلهما لاحقًا من الإعدادات متى أردت.",
				en: "The line shown in the server list and the player slots. Change them later from Settings whenever you like.",
			},
		},
		{
			kind: BridgeSetupStepKind.Open,
			id: INVITE_STEP,
			required: false,
			target: {
				tab: GuideOpenTab.Access,
			},
			title: {
				ar: "ادعُ أصحابك",
				en: "Invite your friends",
			},
			help: {
				ar: "انسخ عنوان سيرفرك وأرسله إلى أصحابك ليدخلوا من Multiplayer ← Add Server.",
				en: "Copy your server address and send it to your friends so they can join from Multiplayer → Add Server.",
			},
		},
	],
};
