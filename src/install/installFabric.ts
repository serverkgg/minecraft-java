import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { FABRIC_META, type FabricEntry, MANIFEST_CACHE_SECONDS, SERVER_JAR, ServerVariant } from "../shared";
import { buildUnavailable } from "./buildUnavailable";
import { jarLaunch } from "./launchPlan";

export const installFabric = async (context: Bridge.Context, gameVersion: string, build: string | null) => {
	const installers = await context.net.json<FabricEntry[]>(`${FABRIC_META}/installer`, {
		cacheSeconds: MANIFEST_CACHE_SECONDS,
	});

	const installer = installers.find((entry) => entry.stable)?.version;

	if (!build) {
		throw buildUnavailable(ServerVariant.Fabric, gameVersion);
	}

	if (!installer) {
		throw new BridgeUserError({
			ar: "لا تتوفر لـ Fabric أداة تثبيت مستقرة حاليًا. جرب مرة ثانية بعد لحظة أو اختر نوع سيرفر آخر من تبويب الإصدار.",
			en: "Fabric has no stable installer right now. Try again in a moment or pick another server type in the Version tab.",
		});
	}

	await context.files.download(SERVER_JAR, `${FABRIC_META}/loader/${gameVersion}/${build}/${installer}/server/jar`);
	await context.files.ensure("mods");

	return jarLaunch;
};
