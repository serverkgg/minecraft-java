import { describe, expect, it } from "bun:test";
import { CatalogProviderId } from "./provider";
import { providerOfLink } from "./providerLink";

describe("the source a pasted link points at", () => {
	it("names curseforge for its site, with or without the www, legacy or beta subdomain", () => {
		expect(providerOfLink("https://www.curseforge.com/minecraft/mc-mods/amw")).toBe(CatalogProviderId.CurseForge);
		expect(providerOfLink("https://curseforge.com/minecraft/bukkit-plugins/worldedit")).toBe(
			CatalogProviderId.CurseForge,
		);
		expect(providerOfLink("https://legacy.curseforge.com/minecraft/mc-mods/jei")).toBe(CatalogProviderId.CurseForge);
		expect(providerOfLink(" https://beta.curseforge.com/minecraft/modpacks/all-the-mods-9 ")).toBe(
			CatalogProviderId.CurseForge,
		);
	});

	it("names modrinth for its site", () => {
		expect(providerOfLink("https://modrinth.com/mod/sodium")).toBe(CatalogProviderId.Modrinth);
	});

	it("names no source for typed text, another site or a look-alike host", () => {
		expect(providerOfLink("sodium")).toBeNull();
		expect(providerOfLink("https://hangar.papermc.io/EssentialsX/Essentials")).toBeNull();
		expect(providerOfLink("https://curseforge.com.example.net/minecraft/mc-mods/amw")).toBeNull();
		expect(providerOfLink("https://notcurseforge.com/minecraft/mc-mods/amw")).toBeNull();
	});
});
