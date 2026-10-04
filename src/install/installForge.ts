import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { FORGE_MAVEN, SERVER_JAR, ServerVariant } from "../shared";
import { buildUnavailable } from "./buildUnavailable";
import { jarLaunch, type LaunchPlan } from "./launchPlan";
import { runLoaderInstaller } from "./loaderInstaller";

const legacyJars = (release: string) => {
	return [
		`forge-${release}.jar`,
		`forge-${release}-universal.jar`,
	];
};

export const installForge = async (
	context: Bridge.Context,
	gameVersion: string,
	build: string | null,
	javaMajor: number,
): Promise<LaunchPlan> => {
	if (!build) {
		throw buildUnavailable(ServerVariant.Forge, gameVersion);
	}

	const release = `${gameVersion}-${build}`;

	const plan = await runLoaderInstaller(context, {
		name: "Forge",
		release,
		installerUrl: `${FORGE_MAVEN}/${release}/forge-${release}-installer.jar`,
		javaMajor,
	});

	await context.files.ensure("mods");

	if (plan) {
		return plan;
	}

	for (const candidate of legacyJars(release)) {
		if (await context.files.exists(candidate)) {
			await context.files.move(candidate, SERVER_JAR);

			return jarLaunch;
		}
	}

	throw new BridgeUserError({
		ar: `انتهت أداة تثبيت Forge دون تجهيز ملف تشغيل السيرفر للإصدار ${release}. اختر إصدار Forge آخر أو إصدار ماينكرافت آخر من تبويب الإصدار.`,
		en: `The Forge installer finished without a server launcher for ${release}. Pick another Forge build or Minecraft version in the Version tab.`,
	});
};
