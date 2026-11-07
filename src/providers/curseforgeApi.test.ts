import { describe, expect, it } from "bun:test";
import {
	CurseforgeModLoader,
	type CurseforgeSearchPage,
	type CurseforgeSearchQuery,
	CurseforgeSort,
} from "@serverkgg/bridge/catalogs";
import {
	CURSEFORGE_CLASS_MODPACKS,
	CURSEFORGE_CLASS_MODS,
	CURSEFORGE_CLASS_PLUGINS,
	CurseforgeLinkOutcome,
	curseforgeLinkSlug,
	curseforgeRelaxedQuery,
	curseforgeSearchPage,
	curseforgeSearchText,
} from "./curseforgeApi";

const page = (names: string[]): CurseforgeSearchPage => ({
	data: names.map((name, index) => ({
		id: index + 1,
		classId: null,
		name,
		slug: name,
		summary: "",
		downloadCount: 0,
		authors: [],
		categories: [],
		dateModified: null,
		allowModDistribution: null,
		logo: null,
		links: null,
	})),
	pagination: {
		index: 0,
		pageSize: 20,
		resultCount: names.length,
		totalCount: names.length,
	},
});

const answerKey = (query: CurseforgeSearchQuery) => {
	return query.slug === undefined ? (query.query ?? "") : `${query.slug}@${query.gameVersion ?? "any"}`;
};

const catalog = (answers: Record<string, string[]>) => {
	const queries: CurseforgeSearchQuery[] = [];

	return {
		queries,
		search: async (query: CurseforgeSearchQuery = {}) => {
			queries.push(query);

			return page(answers[answerKey(query)] ?? []);
		},
	};
};

const AMW_LINK = "https://www.curseforge.com/minecraft/mc-mods/amw";

const MOD_SEARCH: CurseforgeSearchQuery = {
	query: AMW_LINK,
	classId: CURSEFORGE_CLASS_MODS,
	gameVersion: "1.21.1",
	modLoaderType: CurseforgeModLoader.NeoForge,
	categoryId: 435,
	sort: CurseforgeSort.Popularity,
	index: 0,
	pageSize: 20,
};

describe("the text a player's search sends to curseforge", () => {
	it("keeps typed text as it is, trimmed", () => {
		expect(curseforgeSearchText("  Dungeons, Dragons and Space Shuttles 2 ")).toBe(
			"Dungeons, Dragons and Space Shuttles 2",
		);
	});

	it("turns a pasted project page into its slug words, with or without a file", () => {
		expect(curseforgeSearchText("https://www.curseforge.com/minecraft/modpacks/all-the-mods-9")).toBe("all the mods 9");
		expect(curseforgeSearchText("https://www.curseforge.com/minecraft/modpacks/all-the-mods-9/files/5432101")).toBe(
			"all the mods 9",
		);
	});

	it("leaves a link to another site alone", () => {
		expect(curseforgeSearchText("https://modrinth.com/modpack/cobblemon")).toBe(
			"https://modrinth.com/modpack/cobblemon",
		);
	});
});

describe("reading a pasted curseforge project link", () => {
	it("takes the slug of a link whose class matches the search, with or without a file", () => {
		expect(curseforgeLinkSlug(AMW_LINK, CURSEFORGE_CLASS_MODS)).toBe("amw");
		expect(curseforgeLinkSlug(`${AMW_LINK}/files/5432101`, CURSEFORGE_CLASS_MODS)).toBe("amw");
		expect(
			curseforgeLinkSlug("https://legacy.curseforge.com/minecraft/bukkit-plugins/worldedit", CURSEFORGE_CLASS_PLUGINS),
		).toBe("worldedit");
		expect(
			curseforgeLinkSlug("https://curseforge.com/minecraft/modpacks/all-the-mods-9", CURSEFORGE_CLASS_MODPACKS),
		).toBe("all-the-mods-9");
	});

	it("takes no slug from a link to another class", () => {
		expect(curseforgeLinkSlug(AMW_LINK, CURSEFORGE_CLASS_PLUGINS)).toBeNull();
		expect(
			curseforgeLinkSlug("https://www.curseforge.com/minecraft/modpacks/all-the-mods-9", CURSEFORGE_CLASS_MODS),
		).toBeNull();
		expect(curseforgeLinkSlug(AMW_LINK, undefined)).toBeNull();
	});

	it("takes no slug from another site, typed text or a link without a project", () => {
		expect(curseforgeLinkSlug("https://modrinth.com/mod/amw", CURSEFORGE_CLASS_MODS)).toBeNull();
		expect(curseforgeLinkSlug("amw", CURSEFORGE_CLASS_MODS)).toBeNull();
		expect(curseforgeLinkSlug("https://www.curseforge.com/minecraft/mc-mods", CURSEFORGE_CLASS_MODS)).toBeNull();
	});
});

describe("looking a pasted curseforge link up exactly", () => {
	it("asks for the slug with this class, loader and version only, and answers its hits with no outcome", async () => {
		const fake = catalog({
			"amw@1.21.1": [
				"AcceleratedMcWarfare",
			],
		});

		const result = await curseforgeSearchPage(fake, MOD_SEARCH);

		expect(result.page.data.map((mod) => mod.name)).toEqual([
			"AcceleratedMcWarfare",
		]);
		expect(result.outcome).toBeNull();
		expect(fake.queries).toEqual([
			{
				slug: "amw",
				classId: CURSEFORGE_CLASS_MODS,
				gameVersion: "1.21.1",
				modLoaderType: CurseforgeModLoader.NeoForge,
				pageSize: 20,
			},
		]);
	});

	it("names a project with no file for this loader and version as incompatible", async () => {
		const fake = catalog({
			"amw@any": [
				"AcceleratedMcWarfare",
			],
		});

		const result = await curseforgeSearchPage(fake, MOD_SEARCH);

		expect(result.page.data).toEqual([]);
		expect(result.outcome).toEqual({
			kind: CurseforgeLinkOutcome.Incompatible,
			name: "AcceleratedMcWarfare",
		});
		expect(fake.queries.at(1)).toEqual({
			slug: "amw",
			classId: CURSEFORGE_CLASS_MODS,
			pageSize: 1,
		});
	});

	it("calls a project the search does not return at all unlisted", async () => {
		const fake = catalog({});

		const result = await curseforgeSearchPage(fake, MOD_SEARCH);

		expect(result.page.data).toEqual([]);
		expect(result.outcome).toEqual({
			kind: CurseforgeLinkOutcome.Unlisted,
			name: null,
		});
		expect(fake.queries.length).toBe(2);
	});

	it("answers a later page of a link empty without asking curseforge", async () => {
		const fake = catalog({});

		const result = await curseforgeSearchPage(fake, {
			...MOD_SEARCH,
			index: 20,
		});

		expect(result.page.data).toEqual([]);
		expect(result.outcome).toBeNull();
		expect(fake.queries).toEqual([]);
	});
});

describe("relaxing a title curseforge refuses to match", () => {
	it("drops punctuation, joining words and bare numbers, and keeps the first five words", () => {
		expect(curseforgeRelaxedQuery("Dungeons, Dragons and Space Shuttles 2")).toBe("Dungeons Dragons Space Shuttles");
		expect(curseforgeRelaxedQuery("Complex Pixelmon - The #1 Pokemon Adventure in Pixelmon - Multiplayer")).toBe(
			"Complex Pixelmon Pokemon Adventure Pixelmon",
		);
		expect(curseforgeRelaxedQuery("Craft to Exile 2 - 2.0 Atlas Update")).toBe("Craft Exile Atlas Update");
	});

	it("keeps tags that mix letters and digits", () => {
		expect(curseforgeRelaxedQuery("All the Mods 9 - ATM9")).toBe("All Mods ATM9");
	});
});

describe("searching curseforge with the relaxed title as the second try", () => {
	it("returns the first page when the text search finds something", async () => {
		const fake = catalog({
			"space shuttles": [
				"Dungeons, Dragons and Space Shuttles",
			],
		});

		const result = await curseforgeSearchPage(fake, {
			query: "space shuttles",
			index: 0,
		});

		expect(result.page.data.map((mod) => mod.name)).toEqual([
			"Dungeons, Dragons and Space Shuttles",
		]);
		expect(result.outcome).toBeNull();
		expect(fake.queries.length).toBe(1);
	});

	it("retries an empty first page with the relaxed title, keeping every other filter", async () => {
		const fake = catalog({
			"Dungeons Dragons Space Shuttles": [
				"Dungeons, Dragons and Space Shuttles 2",
			],
		});

		const result = await curseforgeSearchPage(fake, {
			query: "Dungeons, Dragons and Space Shuttles 2",
			classId: 4471,
			index: 0,
			pageSize: 20,
		});

		expect(result.page.data.map((mod) => mod.name)).toEqual([
			"Dungeons, Dragons and Space Shuttles 2",
		]);
		expect(result.outcome).toBeNull();
		expect(fake.queries.at(1)).toMatchObject({
			query: "Dungeons Dragons Space Shuttles",
			classId: 4471,
			pageSize: 20,
		});
	});

	it("searches a pasted link to another class by its slug words", async () => {
		const fake = catalog({
			"dungeons dragons and space shuttles 2": [
				"Dungeons, Dragons and Space Shuttles 2",
			],
		});

		const result = await curseforgeSearchPage(fake, {
			query: "https://www.curseforge.com/minecraft/modpacks/dungeons-dragons-and-space-shuttles-2",
			classId: CURSEFORGE_CLASS_MODS,
			index: 0,
		});

		expect(result.page.data.length).toBe(1);
		expect(result.outcome).toBeNull();
		expect(fake.queries.at(0)?.query).toBe("dungeons dragons and space shuttles 2");
	});

	it("does not retry a later page, an empty query, or a title that is already relaxed", async () => {
		const fake = catalog({});

		await curseforgeSearchPage(fake, {
			query: "Dungeons, Dragons and Space Shuttles 2",
			index: 20,
		});
		await curseforgeSearchPage(fake, {
			query: "",
			index: 0,
		});
		await curseforgeSearchPage(fake, {
			query: "Dungeons Dragons Space Shuttles",
			index: 0,
		});

		expect(fake.queries.length).toBe(3);
	});
});
