import { type Bridge, BridgeNetError } from "@serverkgg/bridge";
import { BUILDS_CACHE_SECONDS, PAPER_PROJECT, type PaperBuild, SERVER_JAR, ServerVariant } from "../shared";
import { buildUnavailable } from "./buildUnavailable";
import { jarLaunch } from "./launchPlan";

const publishedBuilds = async (context: Bridge.Context, gameVersion: string) => {
	try {
		return await context.net.json<PaperBuild[]>(`${PAPER_PROJECT}/versions/${encodeURIComponent(gameVersion)}/builds`, {
			cacheSeconds: BUILDS_CACHE_SECONDS,
		});
	} catch (error) {
		if (error instanceof BridgeNetError && error.status === 404) {
			throw buildUnavailable(ServerVariant.Paper, gameVersion);
		}

		throw error;
	}
};

export const installPaper = async (context: Bridge.Context, gameVersion: string, build: string | null) => {
	const builds = await publishedBuilds(context, gameVersion);

	const resolved =
		builds.find((candidate) => String(candidate.id) === build)
		?? builds.find((candidate) => candidate.channel === "STABLE");

	if (!resolved) {
		throw buildUnavailable(ServerVariant.Paper, gameVersion);
	}

	const download = resolved.downloads["server:default"];

	await context.files.download(SERVER_JAR, download.url, {
		digest: `sha256:${download.checksums.sha256}`,
		sizeBytes: download.size,
	});

	await context.files.ensure("plugins");

	return jarLaunch;
};
