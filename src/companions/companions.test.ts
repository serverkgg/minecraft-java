import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { ServerVariant } from "../shared";
import { CROSSPLAY, VERSION_COMPAT } from "./companion";
import { CompanionReadiness, companionReadiness } from "./companions";

const versionsUrlOf = (project: string, loader: string, gameVersion: string) => {
	const url = new URL(`https://api.modrinth.com/v2/project/${project}/version`);

	url.searchParams.set(
		"loaders",
		JSON.stringify([
			loader,
		]),
	);
	url.searchParams.set(
		"game_versions",
		JSON.stringify([
			gameVersion,
		]),
	);

	return url.toString();
};

const releaseOf = (project: string) => {
	return [
		{
			id: `${project}-id`,
			project_id: project,
			version_number: "1.0.0",
			version_type: "release",
			date_published: "2026-10-01T00:00:00Z",
			game_versions: [
				"1.21.9",
			],
			loaders: [
				"fabric",
			],
			files: [
				{
					url: `https://cdn.modrinth.com/data/${project}/${project}.jar`,
					filename: `${project}.jar`,
					primary: true,
					size: 1024,
					hashes: {},
				},
			],
			dependencies: [],
		},
	];
};

const readinessOf = async (net: Record<string, unknown>, variant: ServerVariant, feature = CROSSPLAY) => {
	const downloads: string[] = [];
	const warnings: string[] = [];

	const context = {
		variable: () => null,
		secret: () => null,
		files: {
			list: async () => [],
			download: async (path: string) => {
				downloads.push(path);
			},
		},
		net: {
			json: async (url: string) => {
				if (!(url in net)) {
					throw new Error(`offline: ${url}`);
				}

				return net[url];
			},
		},
		log: Object.assign(() => {}, {
			warn: (message: string) => {
				warnings.push(message);
			},
		}),
	} as unknown as Bridge.Context;

	const readiness = await companionReadiness(context, feature, variant, "1.21.9");

	return {
		downloads,
		readiness,
		warnings,
	};
};

const FABRIC_BUILDS = {
	[versionsUrlOf("geyser", "fabric", "1.21.9")]: releaseOf("geyser"),
	[versionsUrlOf("floodgate", "fabric", "1.21.9")]: releaseOf("floodgate"),
	[versionsUrlOf("P7dR8mSH", "fabric", "1.21.9")]: releaseOf("fabric-api"),
};

describe("companionReadiness", () => {
	it("is ready when every companion and its library has a build, and downloads nothing", async () => {
		const { downloads, readiness } = await readinessOf(FABRIC_BUILDS, ServerVariant.Fabric);

		expect(readiness).toBe(CompanionReadiness.Ready);
		expect(downloads).toEqual([]);
	});

	it("is unresolved on release day, before Geyser publishes a build, and warns no one", async () => {
		const { readiness, warnings } = await readinessOf(
			{
				...FABRIC_BUILDS,
				[versionsUrlOf("geyser", "fabric", "1.21.9")]: [],
			},
			ServerVariant.Fabric,
		);

		expect(readiness).toBe(CompanionReadiness.Unresolved);
		expect(warnings).toEqual([]);
	});

	it("is unsupported on a server type the feature does not run on", async () => {
		expect((await readinessOf({}, ServerVariant.Forge)).readiness).toBe(CompanionReadiness.Unsupported);

		expect((await readinessOf({}, ServerVariant.Fabric, VERSION_COMPAT)).readiness).toBe(
			CompanionReadiness.Unsupported,
		);
	});

	it("is unknown when the catalogue cannot be reached", async () => {
		expect((await readinessOf({}, ServerVariant.Fabric)).readiness).toBe(CompanionReadiness.Unknown);
	});
});
