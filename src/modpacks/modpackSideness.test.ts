import { describe, expect, test } from "bun:test";
import { MODRINTH_UNSUPPORTED } from "../providers";
import type { ModpackFile } from "./modpackIndex";
import { type ModpackSignals, partitionModpackFiles } from "./modpackSideness";
import { PACK_FILES, PACK_SIDES } from "./modpackSideness.fixture";

const UNSUPPORTED = new Set(
	Object.entries(PACK_SIDES).flatMap(([id, side]) => {
		return side === MODRINTH_UNSUPPORTED
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
		digest: "",
		sizeBytes: null,
		projectId,
	};
});

const partition = (signals: Partial<ModpackSignals> = {}) => {
	return partitionModpackFiles(FILES, {
		shielded: signals.shielded ?? new Set<string>(),
		unsupported: signals.unsupported ?? UNSUPPORTED,
	});
};

const { keep, skipped } = partition();

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

describe("the signals that override each other", () => {
	test("a mod modrinth calls client-only is dropped even when its name says nothing", () => {
		const gravestone = FILES.find((file) => file.path.includes("gravestone"));

		expect(gravestone).toBeDefined();

		const projectId = gravestone?.projectId ?? "";
		const dropped = partitionModpackFiles(FILES, {
			shielded: new Set<string>(),
			unsupported: new Set([
				projectId,
			]),
		});

		expect(dropped.skipped.some((file) => file.path.includes("gravestone"))).toBe(true);
	});

	test("the dependency shield keeps a required dependency modrinth marks client-only", () => {
		const gravestone = FILES.find((file) => file.path.includes("gravestone"));
		const projectId = gravestone?.projectId ?? "";
		const shielded = partitionModpackFiles(FILES, {
			shielded: new Set([
				projectId,
			]),
			unsupported: new Set([
				projectId,
			]),
		});

		expect(shielded.keep.some((file) => file.path.includes("gravestone"))).toBe(true);
	});

	test("the whitelist wins over every other signal", () => {
		const whitelisted: ModpackFile[] = [
			{
				path: "mods/Ping-Wheel-1.9.2-forge-1.20.1.jar",
				url: "",
				digest: "",
				sizeBytes: null,
				projectId: "QQXebjcO",
			},
		];

		const partitioned = partitionModpackFiles(whitelisted, {
			shielded: new Set<string>(),
			unsupported: new Set([
				"QQXebjcO",
			]),
		});

		expect(partitioned.keep.length).toBe(1);
		expect(partitioned.skipped.length).toBe(0);
	});

	test("without any modrinth answer the deny list still catches the crashers", () => {
		const blind = partition({
			unsupported: new Set<string>(),
		});

		expect(blind.skipped.some((file) => file.path.toLowerCase().includes("entity_texture_features"))).toBe(true);
		expect(blind.skipped.some((file) => file.path.toLowerCase().includes("oculus"))).toBe(true);
	});
});
