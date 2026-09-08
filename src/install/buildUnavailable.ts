import { BridgeUserError } from "@serverkgg/bridge";
import { type ServerVariant, VARIANT_LABELS } from "../shared";

export const buildUnavailable = (variant: ServerVariant, gameVersion: string) => {
	const label = VARIANT_LABELS[variant];

	return new BridgeUserError({
		ar: `ما فيه إصدار من ${label} لماينكرافت ${gameVersion} لين الحين. اختر نسخة ثانية أو نوع سيرفر ثاني.`,
		en: `${label} has no build for Minecraft ${gameVersion} yet. Pick another version or server type.`,
	});
};
