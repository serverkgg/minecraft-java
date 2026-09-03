import { type Bridge, BridgeFailureCode, BridgeFailureError, BridgeKind } from "@serverkgg/bridge";
import { decodeProviderRef, encodeProviderRef, modpackSourceById, modpackSources } from "../providers";
import { addonDirectory } from "../shared";
import { MODPACK_VARIABLE } from "./applyModpack";
import { describeProject, identityMismatched, outdated, serverRelease } from "./modpackFreshness";
import { usesQuilt, variantForLoaders } from "./modpackIndex";
import { decodeModpackRef, encodeModpackRef } from "./modpackRef";
import { MODPACK_SIDECAR, modpackIdentity, readModpackSidecar } from "./modpackSidecar";

const PAGE_SIZE = 20;

const sources = (context: Bridge.Context): Bridge.CatalogProvider[] => {
	return modpackSources().map((source) => {
		const ready = source.ready(context);

		return {
			id: source.id,
			label: source.label,
			ready,
			...(ready
				? {}
				: {
						note: source.note,
					}),
		};
	});
};

const declaredEntries = async (context: Bridge.Context): Promise<Bridge.CatalogEntry[]> => {
	const declared = context.variable(MODPACK_VARIABLE) ?? "";

	if (declared.length === 0) {
		return [];
	}

	const ref = decodeModpackRef(declared);
	const project = ref ? await describeProject(context, modpackSourceById(ref.provider), ref.project) : null;

	return [
		{
			id: ref ? encodeProviderRef(ref.provider, ref.project) : declared,
			provider: ref?.provider ?? null,
			path: MODPACK_SIDECAR,
			title: project?.title ?? ref?.project ?? declared,
			version: null,
			sizeBytes: 0,
			enabled: true,
			gameVersion: null,
			stale: true,
			pageUrl: project?.pageUrl ?? null,
			icon: project?.icon ?? null,
		},
	];
};

export const installModpack = async (context: Bridge.Context, id: string): Promise<Bridge.CatalogEntry> => {
	const decoded = decodeProviderRef(id);
	const source = decoded ? modpackSourceById(decoded.provider) : null;

	if (!decoded || !source || source.id !== decoded.provider) {
		throw new Error(`"${id}" is not a modpack reference we can install`);
	}

	const releases = await source.releases(context, decoded.project);
	const release = serverRelease(releases);

	if (!release) {
		throw new BridgeFailureError(
			BridgeFailureCode.NoCatalogVersionAvailable,
			releases.some((candidate) => usesQuilt(candidate.loaders))
				? "this modpack runs on quilt, and serverk has no quilt server type"
				: "this modpack has no build we can run on a server",
		);
	}

	const variant = variantForLoaders(release.loaders);
	const mcVersion = release.gameVersions.at(-1) ?? "";

	if (!variant || mcVersion.length === 0) {
		throw new BridgeFailureError(
			BridgeFailureCode.NoCatalogVersionAvailable,
			"this modpack does not say which minecraft version it runs on",
		);
	}

	const project = await source.project(context, decoded.project);

	return {
		id: encodeProviderRef(source.id, project.id),
		provider: source.id,
		path: MODPACK_SIDECAR,
		title: project.title,
		version: release.version,
		sizeBytes: release.file.sizeBytes ?? 0,
		enabled: true,
		gameVersion: modpackIdentity({
			mcVersion,
			variant,
		}),
		stale: false,
		pageUrl: project.pageUrl,
		icon: project.icon,
		variables: {
			[MODPACK_VARIABLE]: encodeModpackRef(source.id, project.id, release.versionId),
			SERVER_TYPE: variant,
			MC_VERSION: mcVersion,
			LOADER_VERSION: "",
		},
	};
};

export const modpacks: Bridge.Catalog = {
	kind: BridgeKind.Catalog,
	pageSize: PAGE_SIZE,

	async search(context, query) {
		const source = modpackSourceById(query.provider);
		const results = await source.search(context, {
			query: query.query,
			page: query.page,
			pageSize: PAGE_SIZE,
			category: query.category,
			sort: query.sort,
		});

		return {
			hits: results.hits.map((hit) => {
				return {
					...hit,
					id: encodeProviderRef(source.id, hit.id),
					provider: source.id,
				};
			}),
			total: results.total,
			providers: sources(context),
			categories: source.categories,
			sorts: source.sorts,
		};
	},

	async installed(context) {
		const sidecar = await readModpackSidecar(context);

		if (!sidecar) {
			return await declaredEntries(context);
		}

		const source = modpackSourceById(sidecar.provider);
		const mismatched = await identityMismatched(context, sidecar);

		return [
			{
				id: encodeProviderRef(sidecar.provider, sidecar.project),
				provider: sidecar.provider,
				path: MODPACK_SIDECAR,
				title: sidecar.title,
				version: sidecar.version,
				sizeBytes: await context.files.size(addonDirectory(context)),
				enabled: true,
				gameVersion: modpackIdentity(sidecar),
				stale: mismatched || (await outdated(context, source, sidecar.project, sidecar.versionId)),
				pageUrl: sidecar.pageUrl,
				icon: sidecar.icon,
			},
		];
	},

	async install(context, id) {
		return await installModpack(context, id);
	},

	async remove() {
		throw new Error("clear the modpack from the modpacks tab, removing it rebuilds the server without it");
	},
};
