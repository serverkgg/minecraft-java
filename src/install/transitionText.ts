import type { Bridge } from "@serverkgg/bridge";
import { VARIANT_LABELS } from "../shared";
import type { InstallIdentity } from "./installStamp";
import {
	AddonOutcome,
	RelocationKind,
	TransitionNote,
	type TransitionPlan,
	WorldLoss,
	WorldOutcome,
} from "./transition";

const nameOf = (identity: InstallIdentity) => {
	return `${VARIANT_LABELS[identity.variant]} ${identity.version}`;
};

export const freshInstallLines = (next: InstallIdentity): Bridge.Text[] => {
	return [
		{
			ar: `ما فيه شي مركّب بعد، نركّب لك ${nameOf(next)}.`,
			en: `Nothing is installed yet, so we install ${nameOf(next)} for you.`,
		},
	];
};

export const unchangedLines = (next: InstallIdentity): Bridge.Text[] => {
	return [
		{
			ar: `سيرفرك أصلًا على ${nameOf(next)}، ما يتغير شي غير إننا نعيد تشغيله.`,
			en: `Your server is already on ${nameOf(next)}, so nothing changes beyond a restart.`,
		},
	];
};

export const modpackDetachLines = (next: InstallIdentity): Bridge.Text[] => {
	return [
		{
			ar: `نشيل المودباك وموداته والماب اللي بنيته عليه، ويرجع سيرفرك عادي على ${nameOf(next)} بماب جديدة.`,
			en: `We remove the modpack, its mods and the world you built on it, and your server goes back to plain on ${nameOf(next)} with a fresh world.`,
		},
	];
};

export const versionOrderUnknownLines = (): Bridge.Text[] => {
	return [
		{
			ar: "ما قدرنا نتأكد من ترتيب نسخ ماينكرافت الحين، فما نقدر نقول لك وش يصير لمابك قبل التغيير. خذ نسخة احتياطية وكمّل بحذر.",
			en: "We could not check the order of the Minecraft versions right now, so we cannot tell you what happens to your world before the change. Take a backup and continue carefully.",
		},
	];
};

const worldLines = (from: InstallIdentity, to: InstallIdentity, plan: TransitionPlan): Bridge.Text[] => {
	if (plan.world === WorldOutcome.Wiped) {
		return [
			{
				ar: `ماينكرافت ما يقدر يفتح ماب اشتغلت على ${from.version} في ${to.version} الأقدم منها: تنحذف مابك وإضافاتك ومودّاتك وإعداداتك ويبدأ سيرفر جديد.`,
				en: `Minecraft cannot open a world made on ${from.version} in the older ${to.version}: your world, plugins, mods and settings are deleted and a fresh server starts.`,
			},
		];
	}

	if (plan.relocation === RelocationKind.LegacyDimensions) {
		return [
			{
				ar: "مابك تبقى مكانها، وننقل النذر والإند حقها جواها عشان يعدّون معها.",
				en: "Your world stays where it is, and we move its Nether and End into it so they carry over.",
			},
		];
	}

	if (plan.relocation === RelocationKind.UnifiedWorldData) {
		return [
			{
				ar: `مابك تبقى مكانها، وننقل ملفات إعداداتها للمكان اللي يدوّر عليه ${VARIANT_LABELS[to.variant]}.`,
				en: `Your world stays where it is, and we move its world-settings files where ${VARIANT_LABELS[to.variant]} expects them.`,
			},
		];
	}

	return [
		{
			ar: "مابك تبقى مكانها زي ما هي.",
			en: "Your world stays exactly where it is.",
		},
	];
};

export const transitionLines = (from: InstallIdentity, to: InstallIdentity, plan: TransitionPlan): Bridge.Text[] => {
	const lines: Bridge.Text[] = [
		{
			ar: `من ${nameOf(from)} إلى ${nameOf(to)}.`,
			en: `From ${nameOf(from)} to ${nameOf(to)}.`,
		},
		...worldLines(from, to, plan),
	];

	if (plan.worldLoss === WorldLoss.ModContent) {
		lines.push({
			ar: "كل اللي أضافته المودات لمابك — بلوكات وأغراض ومخلوقات وأبعاد — يروح أول ما يفتحها السيرفر الجديد، وإذا كانت مابك تستخدم بُعد من مود ممكن السيرفر ما يشتغل. النسخة الاحتياطية هي طريق الرجوع.",
			en: "Everything the mods added to your world — blocks, items, creatures and mod dimensions — is lost the moment the new server opens it, and if it used a mod dimension the new server may not start. The backup is the way back.",
		});
	}

	if (plan.notes.includes(TransitionNote.VersionUnknown)) {
		lines.push({
			ar: `ما نقدر نتأكد إذا ${to.version} أقدم من ${from.version}. نبقي مابك مكانها، لكن إذا طلعت أقدم ممكن ماينكرافت ما يفتحها أو يخربها.`,
			en: `We cannot tell whether ${to.version} is older than ${from.version}. Your world is kept, but if it is older Minecraft may fail to open it or damage it.`,
		});
	}

	if (plan.world === WorldOutcome.Kept && plan.addons === AddonOutcome.Removed) {
		lines.push({
			ar: `إضافاتك ومودّاتك وإعداداتهم تنشال، ما تشتغل على ${VARIANT_LABELS[to.variant]}.`,
			en: `Your plugins, mods and their settings are removed; they do not run on ${VARIANT_LABELS[to.variant]}.`,
		});
	}

	if (plan.notes.includes(TransitionNote.ModsMayNeedUpdate)) {
		lines.push({
			ar: `المودات المبنية على ${from.version} ممكن ما تشتغل على ${to.version}. حدّثها من تبويب المودات إذا سيرفرك رفض يشتغل.`,
			en: `Mods built for ${from.version} may not load on ${to.version}. Update them from the Mods tab if the server refuses to start.`,
		});
	}

	return lines;
};
