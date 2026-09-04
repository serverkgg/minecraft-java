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
				ar: "اختر النسخة",
				en: "Pick your version",
			},
			help: {
				ar: "نوع السيرفر ونسخة ماينكرافت. تغييرها يعيد التركيب، فاختر من الحين لو تبي إضافات أو مودات. تقدر تتخطاها وتبقى على الأحدث.",
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
				ar: "سمِّ سيرفرك",
				en: "Name your server",
			},
			help: {
				ar: "الرسالة اللي تطلع في قائمة السيرفرات وعدد اللاعبين. تقدر تعدّلها بعدين من الإعدادات.",
				en: "The line shown in the server list and the player slots. You can change them later from Settings.",
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
				ar: "عزّم أصحابك",
				en: "Invite your friends",
			},
			help: {
				ar: "انسخ عنوان سيرفرك وأرسله لأصحابك عشان يدخلون من Multiplayer ← Add Server.",
				en: "Copy your server address and send it to your friends so they can join from Multiplayer → Add Server.",
			},
		},
	],
};
