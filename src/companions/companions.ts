import type { Bridge } from "@serverkgg/bridge";
import { installedGameVersion } from "../install";
import { modrinthLoaderRelease } from "../providers";
import { addonDirectory, DISABLED_SUFFIX, enabledName, replaceFiles, variantOf } from "../shared";
import {
	COMPANION_FEATURES,
	type Companion,
	type CompanionArtifact,
	type CompanionFeature,
	type CompanionModrinth,
	type CompanionRequirement,
	CompanionSource,
	companionsOf,
	featureEnabled,
} from "./companion";
import {
	type CompanionRecord,
	type CompanionSidecar,
	readCompanionSidecar,
	writeCompanionSidecar,
} from "./companionSidecar";
import { geyserArtifact } from "./geyserDownload";
import { mergeYaml } from "./yamlConfig";

interface ResolvedCompanion {
	companion: Companion;
	artifact: CompanionArtifact;
	source: CompanionSource;
	version: string;
	url: string;
	digest: string | null;
	sizeBytes: number | null;
}

interface ResolvedRequirement {
	requirement: CompanionRequirement;
	version: string;
	url: string;
	digest: string | null;
	sizeBytes: number | null;
}

interface ResolvedFeature {
	companions: ResolvedCompanion[];
	requirements: ResolvedRequirement[];
}

interface ConfigPass {
	pending: number;
}

const PIN_ATTEMPTS = 12;

const PIN_DELAY_MS = 5000;

const parkedPath = (path: string) => {
	return `${path}${DISABLED_SUFFIX}`;
};

const park = async (context: Bridge.Context, path: string) => {
	if (await context.files.exists(path)) {
		await context.files.move(path, parkedPath(path));
	}
};

const unpark = async (context: Bridge.Context, path: string) => {
	if (await context.files.exists(parkedPath(path))) {
		await context.files.move(parkedPath(path), path);
	}
};

const parkFeature = async (context: Bridge.Context, members: Companion[], directory: string) => {
	const variant = variantOf(context);

	for (const companion of members) {
		const artifact = companion.artifacts[variant];

		if (artifact) {
			await park(context, `${directory}/${artifact.filename}`);
		}
	}
};

const modrinthRelease = async (context: Bridge.Context, modrinth: CompanionModrinth, gameVersion: string | null) => {
	if (!modrinth.matchGameVersion) {
		return modrinthLoaderRelease(context, modrinth.project, modrinth.loader, null);
	}

	if (gameVersion === null) {
		return null;
	}

	return modrinthLoaderRelease(context, modrinth.project, modrinth.loader, gameVersion);
};

const resolveCompanion = async (
	context: Bridge.Context,
	companion: Companion,
	artifact: CompanionArtifact,
	gameVersion: string | null,
): Promise<ResolvedCompanion | null> => {
	if (artifact.download) {
		const resolved = await geyserArtifact(context, artifact.download.project, artifact.download.artifact);

		if (resolved) {
			return {
				companion,
				artifact,
				source: CompanionSource.GeyserMc,
				version: resolved.version,
				url: resolved.url,
				digest: resolved.digest,
				sizeBytes: null,
			};
		}
	}

	if (artifact.modrinth) {
		const release = await modrinthRelease(context, artifact.modrinth, gameVersion);

		if (release) {
			return {
				companion,
				artifact,
				source: CompanionSource.Modrinth,
				version: release.version,
				url: release.file.url,
				digest: release.file.digest,
				sizeBytes: release.file.sizeBytes,
			};
		}
	}

	return null;
};

const requirementPresent = async (context: Bridge.Context, requirement: CompanionRequirement, directory: string) => {
	const entries = await context.files.list(`${directory}/*`);

	return entries.some((entry) => !entry.name.endsWith(DISABLED_SUFFIX) && requirement.files.test(entry.name));
};

const resolveRequirement = async (
	context: Bridge.Context,
	requirement: CompanionRequirement,
	gameVersion: string | null,
): Promise<ResolvedRequirement | null> => {
	if (gameVersion === null) {
		return null;
	}

	const release = await modrinthLoaderRelease(context, requirement.project, requirement.loader, gameVersion);

	if (!release) {
		return null;
	}

	return {
		requirement,
		version: release.version,
		url: release.file.url,
		digest: release.file.digest,
		sizeBytes: release.file.sizeBytes,
	};
};

const resolveFeature = async (
	context: Bridge.Context,
	members: Companion[],
	directory: string,
	gameVersion: string | null,
): Promise<ResolvedFeature | null> => {
	const variant = variantOf(context);
	const resolved: ResolvedCompanion[] = [];
	const requirements = new Map<string, ResolvedRequirement>();

	for (const companion of members) {
		const artifact = companion.artifacts[variant];

		if (!artifact) {
			context.log.warn("this server type has no build of a companion", {
				feature: companion.feature.id,
				companion: companion.id,
				variant,
			});

			return null;
		}

		const candidate = await resolveCompanion(context, companion, artifact, gameVersion);

		if (!candidate) {
			context.log.warn("could not find a download for a companion", {
				feature: companion.feature.id,
				companion: companion.id,
				variant,
				gameVersion,
			});

			return null;
		}

		resolved.push(candidate);

		for (const requirement of artifact.requires) {
			if (requirements.has(requirement.id) || (await requirementPresent(context, requirement, directory))) {
				continue;
			}

			const found = await resolveRequirement(context, requirement, gameVersion);

			if (!found) {
				context.log.warn("a companion needs a library we could not find for this version", {
					feature: companion.feature.id,
					companion: companion.id,
					requirement: requirement.title,
					gameVersion,
				});

				return null;
			}

			requirements.set(requirement.id, found);
		}
	}

	return {
		companions: resolved,
		requirements: [
			...requirements.values(),
		],
	};
};

const sweepDuplicates = async (context: Bridge.Context, companion: Companion, directory: string, keep: string) => {
	const entries = await context.files.list(`${directory}/*`);

	for (const entry of entries) {
		const name = enabledName(entry.name);

		if (name === keep || !companion.files.test(name)) {
			continue;
		}

		await context.files.remove(entry.path);

		context.log("removed a duplicate companion", {
			feature: companion.feature.id,
			companion: companion.id,
			file: entry.path,
		});
	}
};

const writeConfigs = async (
	context: Bridge.Context,
	companion: Companion,
	artifact: CompanionArtifact,
): Promise<ConfigPass> => {
	let pending = 0;

	for (const config of artifact.configs) {
		if (!(await context.files.exists(config.path))) {
			pending += 1;

			continue;
		}

		const current = await context.files.read(config.path);
		const merged = mergeYaml(current, config.entries(context));

		if (merged === current) {
			continue;
		}

		await context.files.write(config.path, merged);

		context.log("updated a companion config", {
			companion: companion.id,
			path: config.path,
		});
	}

	return {
		pending,
	};
};

const applyFeature = async (
	context: Bridge.Context,
	resolved: ResolvedFeature,
	directory: string,
	sidecar: CompanionSidecar,
	gameVersion: string | null,
) => {
	await context.files.ensure(directory);

	const downloads = [];
	const removed: string[] = [];
	for (const entry of resolved.requirements) {
		downloads.push({
			path: `${directory}/${entry.requirement.filename}`,
			url: entry.url,
			...(entry.digest
				? {
						digest: entry.digest,
					}
				: {}),
			...(entry.sizeBytes === null
				? {}
				: {
						sizeBytes: entry.sizeBytes,
					}),
		});
	}
	for (const entry of resolved.companions) {
		const path = `${directory}/${entry.artifact.filename}`;
		const tracked = sidecar.entries[entry.companion.id];
		const present = (await context.files.exists(path)) || (await context.files.exists(parkedPath(path)));
		if (!(tracked?.jar === path && tracked.version === entry.version && present)) {
			downloads.push({
				path,
				url: entry.url,
				...(entry.digest
					? {
							digest: entry.digest,
						}
					: {}),
				...(entry.sizeBytes === null
					? {}
					: {
							sizeBytes: entry.sizeBytes,
						}),
			});
			removed.push(parkedPath(path));
		}
		sidecar.entries[entry.companion.id] = {
			jar: path,
			gameVersion: gameVersion ?? "",
			source: entry.source,
			version: entry.version,
		} satisfies CompanionRecord;
	}
	await replaceFiles(context, downloads, removed, () => writeCompanionSidecar(context, sidecar));
	for (const entry of resolved.companions) {
		await sweepDuplicates(context, entry.companion, directory, entry.artifact.filename);
		await unpark(context, `${directory}/${entry.artifact.filename}`);
	}

	for (const entry of resolved.companions) {
		const pass = await writeConfigs(context, entry.companion, entry.artifact);

		if (pass.pending > 0) {
			context.log("a companion has not written its config yet, pinning it once the server is up", {
				companion: entry.companion.id,
				pending: pass.pending,
			});
		}
	}
};

const preserveFeature = async (context: Bridge.Context, members: Companion[], sidecar: CompanionSidecar) => {
	const version = await installedGameVersion(context);
	for (const member of members) {
		const tracked = sidecar.entries[member.id];
		if (!tracked || tracked.gameVersion !== version || !(await context.files.exists(tracked.jar))) {
			return false;
		}
	}
	return true;
};

const syncFeature = async (context: Bridge.Context, feature: CompanionFeature) => {
	const members = companionsOf(feature);
	const directory = addonDirectory(context);
	const sidecar = await readCompanionSidecar(context);
	const before = JSON.stringify(sidecar);

	if (!featureEnabled(context, feature)) {
		await parkFeature(context, members, directory);

		return;
	}

	try {
		const gameVersion = await installedGameVersion(context);
		const resolved = await resolveFeature(context, members, directory, gameVersion);

		if (!resolved) {
			if (!(await preserveFeature(context, members, sidecar))) {
				await parkFeature(context, members, directory);
			}

			return;
		}

		await applyFeature(context, resolved, directory, sidecar, gameVersion);
	} catch (error) {
		context.log.warn("could not update a companion feature, keeping compatible installed files when available", {
			feature: feature.id,
			reason: error instanceof Error ? error.message : String(error),
		});

		if (!(await preserveFeature(context, members, await readCompanionSidecar(context)))) {
			await parkFeature(context, members, directory);
		}
		return;
	}

	if (JSON.stringify(sidecar) !== before) {
		await writeCompanionSidecar(context, sidecar);
	}
};

export const syncCompanions = async (context: Bridge.Context) => {
	for (const feature of COMPANION_FEATURES) {
		try {
			await syncFeature(context, feature);
		} catch (error) {
			context.log.warn("skipped a companion feature", {
				feature: feature.id,
				reason: error instanceof Error ? error.message : String(error),
			});
		}
	}
};

const pinPass = async (context: Bridge.Context) => {
	const variant = variantOf(context);

	let pending = 0;

	for (const feature of COMPANION_FEATURES) {
		if (!featureEnabled(context, feature)) {
			continue;
		}

		for (const companion of companionsOf(feature)) {
			const artifact = companion.artifacts[variant];

			if (!artifact) {
				continue;
			}

			pending += (await writeConfigs(context, companion, artifact)).pending;
		}
	}

	return pending;
};

export const pinCompanionConfigs = async (context: Bridge.Context) => {
	for (let attempt = 0; attempt < PIN_ATTEMPTS; attempt += 1) {
		try {
			if ((await pinPass(context)) === 0) {
				return;
			}
		} catch (error) {
			context.log.warn("could not pin a companion config, it is pinned on the next start", {
				reason: error instanceof Error ? error.message : String(error),
			});

			return;
		}

		await Bun.sleep(PIN_DELAY_MS);
	}
};
