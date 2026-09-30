import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { NEOFORGE_MAVEN, ServerVariant } from "../shared";
import { buildUnavailable } from "./buildUnavailable";
import type { LaunchPlan } from "./launchPlan";
import { runLoaderInstaller } from "./loaderInstaller";

export const installNeoForge = async (
	context: Bridge.Context,
	gameVersion: string,
	build: string | null,
	javaMajor: number,
): Promise<LaunchPlan> => {
	if (!build) {
		throw buildUnavailable(ServerVariant.NeoForge, gameVersion);
	}

	const plan = await runLoaderInstaller(context, {
		name: "NeoForge",
		release: build,
		installerUrl: `${NEOFORGE_MAVEN}/${build}/neoforge-${build}-installer.jar`,
		javaMajor,
	});

	await context.files.ensure("mods");

	if (!plan) {
		throw new BridgeUserError({
			ar: `أداة تثبيت NeoForge خلصت بدون ما تجهّز ملف تشغيل السيرفر للإصدار ${build}. اختَر إصدار NeoForge ثاني أو نسخة ماينكرافت ثانية من تبويب النسخة.`,
			en: `The NeoForge installer finished without a server launcher for ${build}. Pick another NeoForge build or Minecraft version in the Version tab.`,
		});
	}

	return plan;
};
