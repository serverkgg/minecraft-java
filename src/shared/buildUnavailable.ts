import { BridgeUserError } from "@serverkgg/bridge";
import { type ServerVariant, VARIANT_LABELS } from "./variant";

export const buildUnavailable = (variant: ServerVariant, gameVersion: string) => {
	const label = VARIANT_LABELS[variant];

	return new BridgeUserError({
		ar: `لا يتوفر إصدار مستقر من ${label} لـ ماينكرافت ${gameVersion} حتى الآن. اختر إصدارًا آخر أو نوع سيرفر آخر.`,
		en: `${label} has no stable build for Minecraft ${gameVersion} yet. Pick another version or server type.`,
	});
};

export const buildUnpublished = (variant: ServerVariant, build: string) => {
	const label = VARIANT_LABELS[variant];

	return new BridgeUserError({
		ar: `الإصدار ${build} من ${label} لم يعد منشورًا. اختر إصدارًا آخر من المشغّل.`,
		en: `${label} build ${build} is no longer published. Pick another loader build.`,
	});
};
