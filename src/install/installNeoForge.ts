import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { type AcceptedBuild, buildUnavailable, ServerVariant } from "../shared";
import type { LaunchPlan } from "./launchPlan";
import { runLoaderInstaller } from "./loaderInstaller";

export const installNeoForge = async (
	context: Bridge.Context,
	gameVersion: string,
	accepted: AcceptedBuild,
	javaMajor: number,
): Promise<LaunchPlan> => {
	const { build } = accepted;

	if (!build) {
		throw buildUnavailable(ServerVariant.NeoForge, gameVersion);
	}

	const plan = await runLoaderInstaller(context, {
		name: "NeoForge",
		release: build,
		installerUrl: accepted.url,
		digest: accepted.digest,
		javaMajor,
	});

	await context.files.ensure("mods");

	if (!plan) {
		throw new BridgeUserError({
			ar: `انتهت أداة تثبيت NeoForge دون تجهيز ملف تشغيل السيرفر للإصدار ${build}. اختر إصدار NeoForge آخر أو إصدار ماينكرافت آخر من تبويب الإصدار.`,
			en: `The NeoForge installer finished without a server launcher for ${build}. Pick another NeoForge build or Minecraft version in the Version tab.`,
		});
	}

	return plan;
};
