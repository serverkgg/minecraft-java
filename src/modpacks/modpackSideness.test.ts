import { describe, expect, test } from "bun:test";
import type { ModpackFile } from "./modpackIndex";
import { partitionModpackFiles } from "./modpackSideness";
import { PACK_FILES, PACK_SIDES } from "./modpackSideness.fixture";

const UNSUPPORTED = new Set(
	Object.entries(PACK_SIDES).flatMap(([id, side]) => {
		return side === "unsupported"
			? [
					id,
				]
			: [];
	}),
);

const FILES: ModpackFile[] = PACK_FILES.map(([path, projectId]) => {
	return {
		path,
		url: "",
		digest: null,
		sizeBytes: null,
		projectId,
	};
});

const { keep, skipped } = partitionModpackFiles(FILES, UNSUPPORTED);

const kept = keep.map((file) => file.path.toLowerCase());
const left = skipped.map((file) => file.path.toLowerCase());

const inList = (list: string[], needle: string) => {
	return list.some((path) => path.includes(needle));
};

describe("a modpack that claims every file runs on a server", () => {
	test("leaves out the client-only mod that crashed the server", () => {
		expect(inList(left, "entity_texture_features")).toBe(true);
		expect(inList(kept, "entity_texture_features")).toBe(false);
	});

	test("leaves out the client-only mods that came with it", () => {
		for (const mod of [
			"oculus",
			"physics-mod",
			"embeddium",
			"entity_model_features",
			"inventoryhud",
		]) {
			expect(inList(left, mod)).toBe(true);
		}
	});

	test("keeps the libraries a server actually needs", () => {
		for (const library of [
			"geckolib",
			"creativecore",
			"architectury",
			"puzzleslib",
			"terrablender",
		]) {
			expect(inList(kept, library)).toBe(true);
		}
	});

	test("drops a client-only library together with the mod that depends on it", () => {
		expect(inList(left, "libipn")).toBe(true);
		expect(inList(left, "inventoryprofilesnext")).toBe(true);
	});

	test("still installs a mod whose project no longer exists on modrinth", () => {
		expect(inList(kept, "smsn")).toBe(true);
	});

	test("never sends shaderpacks or resourcepacks to a server", () => {
		expect(kept.some((path) => path.startsWith("shaderpacks/") || path.startsWith("resourcepacks/"))).toBe(false);
	});

	test("removes the mods modrinth says a server can run only when they are known to be client-side", () => {
		const supported = new Set(
			FILES.flatMap((file) => {
				return file.projectId !== null && UNSUPPORTED.has(file.projectId)
					? []
					: [
							file.path.toLowerCase(),
						];
			}),
		);

		expect(left.filter((path) => supported.has(path)).sort()).toEqual(
			[
				"mods/forgeconfigscreens-v8.0.2-1.20.1-forge.jar",
				"mods/fancymenu_forge_3.7.0_mc_1.20.1.jar",
				"mods/xaeros_minimap_25.2.10_forge_1.20.jar",
				"mods/xaerosworldmap_1.39.12_forge_1.20.jar",
			].sort(),
		);
	});

	test("keeps most of the pack rather than gutting it", () => {
		expect(keep.length + skipped.length).toBe(129);
		expect(skipped.length).toBe(53);
		expect(keep.length).toBe(76);
	});
});
