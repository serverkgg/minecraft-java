import type { Bridge } from "@serverkgg/bridge";
import { type CompanionFeature, CompanionReadiness, CROSSPLAY, VERSION_COMPAT } from "../companions";
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
			ar: `لا يوجد شيء مثبّت بعد، لذلك نثبّت ${nameOf(next)}.`,
			en: `Nothing is installed yet, so we install ${nameOf(next)} for you.`,
		},
	];
};

export const unchangedLines = (next: InstallIdentity): Bridge.Text[] => {
	return [
		{
			ar: `سيرفرك على ${nameOf(next)} مسبقًا، ولن يتغير شيء سوى ريستارت السيرفر.`,
			en: `Your server is already on ${nameOf(next)}, so nothing changes beyond a restart.`,
		},
	];
};

export const modpackDetachLines = (next: InstallIdentity, archived: string | null): Bridge.Text[] => {
	if (archived === null) {
		return [
			{
				ar: `نزيل المودباك وموداته، ويعود سيرفرك إلى ${nameOf(next)} دون مودباك وبماب جديد.`,
				en: `We remove the modpack and its mods, and your server returns to ${nameOf(next)} without a modpack and with a fresh world.`,
			},
		];
	}

	return [
		{
			ar: `نزيل المودباك وموداته، ونحفظ الماب الذي بنيته عليه باسم «${archived}» في تبويب المابات، ويعود سيرفرك إلى ${nameOf(next)} دون مودباك وبماب جديد.`,
			en: `We remove the modpack and its mods, keep the world you built on it as "${archived}" in the Worlds tab, and your server returns to ${nameOf(next)} without a modpack and with a fresh world.`,
		},
	];
};

export const versionOrderUnknownLines = (): Bridge.Text[] => {
	return [
		{
			ar: "تعذّر التحقق من ترتيب إصدارات ماينكرافت حاليًا، ولذلك لا يمكن تحديد ما سيحدث لمابك قبل التغيير. خذ نسخة احتياطية وتابع بحذر.",
			en: "We couldn't check the order of the Minecraft versions right now, so we can't tell you what happens to your world before the change. Take a backup and continue carefully.",
		},
	];
};

const worldLines = (from: InstallIdentity, to: InstallIdentity, plan: TransitionPlan): Bridge.Text[] => {
	if (plan.world === WorldOutcome.Wiped) {
		return [
			{
				ar: `لا يستطيع ماينكرافت فتح ماب شُغّل على ${from.version} في الإصدار الأقدم ${to.version}، لذلك يُحذف مابك وإضافاتك وموداتك وإعداداتك ويبدأ سيرفر جديد.`,
				en: `Minecraft can't open a world made on ${from.version} in the older ${to.version}, so your world, plugins, mods and settings are deleted and a fresh server starts.`,
			},
		];
	}

	if (plan.relocation === RelocationKind.LegacyDimensions) {
		return [
			{
				ar: "يبقى مابك في مكانه، وننقل إليه النذر والإند الخاصين به لكي ينتقلا معه.",
				en: "Your world stays where it is, and we move its Nether and End into it so they carry over.",
			},
		];
	}

	if (plan.relocation === RelocationKind.UnifiedWorldData) {
		return [
			{
				ar: `يبقى مابك في مكانه، وننقل ملفات إعداداته إلى المكان الذي يتوقعه ${VARIANT_LABELS[to.variant]}.`,
				en: `Your world stays where it is, and we move its world-settings files where ${VARIANT_LABELS[to.variant]} expects them.`,
			},
		];
	}

	return [
		{
			ar: "يبقى مابك في مكانه كما هو.",
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
			ar: "كل ما أضافته المودات إلى مابك، من بلوكات وأغراض ومخلوقات وأبعاد، يُفقد بمجرد أن يفتحه السيرفر الجديد، وإذا كان مابك يستخدم بُعدًا من مود فقد لا يشتغل السيرفر. النسخة الاحتياطية هي طريق الرجوع.",
			en: "Everything the mods added to your world (blocks, items, creatures and mod dimensions) is lost the moment the new server opens it, and if your world used a mod dimension, the new server may not start. The backup is the way back.",
		});
	}

	if (plan.notes.includes(TransitionNote.VersionUnknown)) {
		lines.push({
			ar: `لا يمكن التأكد مما إذا كان ${to.version} أقدم من ${from.version}. يبقى مابك في مكانه، لكن إذا كان أقدم فقد لا يفتحه ماينكرافت أو قد يتلفه.`,
			en: `We can't tell whether ${to.version} is older than ${from.version}. Your world is kept, but if it's older, Minecraft may fail to open it or damage it.`,
		});
	}

	if (plan.world === WorldOutcome.Kept && plan.addons === AddonOutcome.Removed) {
		lines.push({
			ar: `تتم إزالة إضافاتك وموداتك وإعداداتها، لأنها لا تشتغل على ${VARIANT_LABELS[to.variant]}.`,
			en: `Your plugins, mods and their settings are removed because they don't run on ${VARIANT_LABELS[to.variant]}.`,
		});
	}

	if (plan.notes.includes(TransitionNote.ModsMayNeedUpdate)) {
		lines.push({
			ar: `قد لا تشتغل المودات المبنية على ${from.version} على ${to.version}. حدّثها من تبويب المودات إذا لم يشتغل السيرفر.`,
			en: `Mods built for ${from.version} may not load on ${to.version}. Update them from the Mods tab if the server doesn't start.`,
		});
	}

	return lines;
};

export interface CompanionNotice {
	feature: CompanionFeature;
	readiness: CompanionReadiness;
}

const variantsOf = (feature: CompanionFeature): Bridge.Text => {
	const labels = feature.variants.map((variant) => VARIANT_LABELS[variant]);
	const last = labels.at(-1) ?? "";
	const rest = labels.slice(0, -1);

	return {
		ar: [
			...rest,
			last,
		].join(" أو "),
		en: rest.length === 0 ? last : `${rest.join(", ")} or ${last}`,
	};
};

const crossplayLine = (to: InstallIdentity, readiness: CompanionReadiness): Bridge.Text | null => {
	if (readiness === CompanionReadiness.Unresolved) {
		return {
			ar: `لن يعمل الكروس بلاي على ${nameOf(to)} حتى يدعمه Geyser. يبقى مفعّلًا ويعود تلقائيًا عندما يتوفر.`,
			en: `Crossplay won't work on ${nameOf(to)} until Geyser supports it. It stays on and comes back on its own once it does.`,
		};
	}

	if (readiness === CompanionReadiness.Unsupported) {
		const variants = variantsOf(CROSSPLAY);

		return {
			ar: `لا يعمل الكروس بلاي على ${VARIANT_LABELS[to.variant]}. يبقى مفعّلًا ويعود تلقائيًا عند العودة إلى ${variants.ar}.`,
			en: `Crossplay doesn't run on ${VARIANT_LABELS[to.variant]}. It stays on and comes back on its own when you switch back to ${variants.en}.`,
		};
	}

	return null;
};

const versionCompatLine = (to: InstallIdentity, readiness: CompanionReadiness): Bridge.Text | null => {
	if (readiness === CompanionReadiness.Unresolved) {
		return {
			ar: `لن يعمل توافق الإصدارات على ${nameOf(to)} حتى يدعمه ViaVersion. يبقى مفعّلًا ويعود تلقائيًا عندما يتوفر.`,
			en: `Version compatibility won't work on ${nameOf(to)} until ViaVersion supports it. It stays on and comes back on its own once it does.`,
		};
	}

	if (readiness === CompanionReadiness.Unsupported) {
		const variants = variantsOf(VERSION_COMPAT);

		return {
			ar: `لا يعمل توافق الإصدارات على ${VARIANT_LABELS[to.variant]}. يبقى مفعّلًا ويعود تلقائيًا عند العودة إلى ${variants.ar}.`,
			en: `Version compatibility doesn't run on ${VARIANT_LABELS[to.variant]}. It stays on and comes back on its own when you switch back to ${variants.en}.`,
		};
	}

	return null;
};

export const companionLines = (to: InstallIdentity, notices: CompanionNotice[]): Bridge.Text[] => {
	return notices.flatMap(({ feature, readiness }) => {
		const line =
			feature === CROSSPLAY
				? crossplayLine(to, readiness)
				: feature === VERSION_COMPAT
					? versionCompatLine(to, readiness)
					: null;

		return line
			? [
					line,
				]
			: [];
	});
};

export const transitionActivityText = (
	from: InstallIdentity,
	to: InstallIdentity,
	plan: TransitionPlan,
): Bridge.Text => {
	const moved = {
		ar: `تم نقل السيرفر من ${nameOf(from)} إلى ${nameOf(to)}`,
		en: `Moved the server from ${nameOf(from)} to ${nameOf(to)}`,
	};

	if (plan.world === WorldOutcome.Wiped) {
		return {
			ar: `${moved.ar}، ولأن ${to.version} أقدم من ${from.version} تم حذف الماب والإضافات والمودات والإعدادات وبدأ سيرفر جديد`,
			en: `${moved.en}, and since ${to.version} is older than ${from.version} the world, plugins, mods and settings were deleted and a fresh server started`,
		};
	}

	if (plan.addons === AddonOutcome.Removed) {
		return {
			ar: `${moved.ar}، وبقي الماب كما هو، وتمت إزالة الإضافات والمودات لأنها لا تشتغل على ${VARIANT_LABELS[to.variant]}`,
			en: `${moved.en}, the world was kept, and plugins and mods were removed because they don't run on ${VARIANT_LABELS[to.variant]}`,
		};
	}

	return {
		ar: `${moved.ar}، وبقي الماب كما هو`,
		en: `${moved.en}, the world was kept`,
	};
};
