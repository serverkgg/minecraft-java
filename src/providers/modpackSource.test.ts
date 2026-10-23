import { describe, expect, it } from "bun:test";
import { BridgeUserError } from "@serverkgg/bridge";
import { MODPACK_SOURCE_UNKNOWN, modpackSourceById, modpackSources } from "./modpackSource";
import { CatalogProviderId } from "./provider";

describe("finding the source a modpack comes from", () => {
	it("finds every source by its id, uploads included", () => {
		for (const id of [
			CatalogProviderId.Modrinth,
			CatalogProviderId.CurseForge,
			CatalogProviderId.Upload,
		]) {
			expect(modpackSourceById(id).id).toBe(id);
		}
	});

	it("starts on modrinth when no source was picked", () => {
		expect(modpackSourceById(null).id).toBe(CatalogProviderId.Modrinth);
	});

	it("refuses a source it does not know instead of guessing modrinth", () => {
		let refusal: unknown = null;

		try {
			modpackSourceById("nope");
		} catch (error) {
			refusal = error;
		}

		expect(refusal).toBeInstanceOf(BridgeUserError);
		expect((refusal as BridgeUserError).text).toEqual(MODPACK_SOURCE_UNKNOWN);
	});

	it("offers the uploads beside the two catalogs", () => {
		expect(modpackSources().map((source) => source.id)).toEqual([
			CatalogProviderId.Modrinth,
			CatalogProviderId.CurseForge,
			CatalogProviderId.Upload,
		]);
	});
});
