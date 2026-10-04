import { BridgeUserError } from "@serverkgg/bridge";
import { type ServerVariant, VARIANT_LABELS } from "../shared";

export const buildUnavailable = (variant: ServerVariant, gameVersion: string) => {
	const label = VARIANT_LABELS[variant];

	return new BridgeUserError({
		ar: `لا يتوفر إصدار من ${label} لـ ماينكرافت ${gameVersion} حتى الآن. اختر إصدارًا آخر أو نوع سيرفر آخر.`,
		en: `${label} has no build for Minecraft ${gameVersion} yet. Pick another version or server type.`,
	});
};
