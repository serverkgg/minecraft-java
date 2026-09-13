import { describe, expect, test } from "bun:test";
import type { CurseforgeSearchPage, CurseforgeSearchQuery } from "@serverkgg/bridge/catalogs";
import { curseforgeRelaxedQuery, curseforgeSearchPage, curseforgeSearchText } from "./curseforgeApi";

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

const catalog = (answers: Record<string, string[]>) => {
	const queries: CurseforgeSearchQuery[] = [];

	return {
		queries,
		search: async (query: CurseforgeSearchQuery = {}) => {
			queries.push(query);

			return page(answers[query.query ?? ""] ?? []);
		},
	};
};

describe("the text a player's search sends to curseforge", () => {
	test("keeps typed text as it is, trimmed", () => {
		expect(curseforgeSearchText("  Dungeons, Dragons and Space Shuttles 2 ")).toBe(
			"Dungeons, Dragons and Space Shuttles 2",
		);
	});

	test("turns a pasted project page into its slug words, with or without a file", () => {
		expect(curseforgeSearchText("https://www.curseforge.com/minecraft/modpacks/all-the-mods-9")).toBe("all the mods 9");
		expect(curseforgeSearchText("https://www.curseforge.com/minecraft/modpacks/all-the-mods-9/files/5432101")).toBe(
			"all the mods 9",
		);
	});

	test("leaves a link to another site alone", () => {
		expect(curseforgeSearchText("https://modrinth.com/modpack/cobblemon")).toBe(
			"https://modrinth.com/modpack/cobblemon",
		);
	});
});

describe("relaxing a title curseforge refuses to match", () => {
	test("drops punctuation, joining words and bare numbers, and keeps the first five words", () => {
		expect(curseforgeRelaxedQuery("Dungeons, Dragons and Space Shuttles 2")).toBe("Dungeons Dragons Space Shuttles");
		expect(curseforgeRelaxedQuery("Complex Pixelmon - The #1 Pokemon Adventure in Pixelmon - Multiplayer")).toBe(
			"Complex Pixelmon Pokemon Adventure Pixelmon",
		);
		expect(curseforgeRelaxedQuery("Craft to Exile 2 - 2.0 Atlas Update")).toBe("Craft Exile Atlas Update");
	});

	test("keeps tags that mix letters and digits", () => {
		expect(curseforgeRelaxedQuery("All the Mods 9 - ATM9")).toBe("All Mods ATM9");
	});
});

describe("searching curseforge with the relaxed title as the second try", () => {
	test("returns the first page when the text search finds something", async () => {
		const fake = catalog({
			"space shuttles": [
				"Dungeons, Dragons and Space Shuttles",
			],
		});

		const result = await curseforgeSearchPage(fake, {
			query: "space shuttles",
			index: 0,
		});

		expect(result.data.map((mod) => mod.name)).toEqual([
			"Dungeons, Dragons and Space Shuttles",
		]);
		expect(fake.queries.length).toBe(1);
	});

	test("retries an empty first page with the relaxed title, keeping every other filter", async () => {
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

		expect(result.data.map((mod) => mod.name)).toEqual([
			"Dungeons, Dragons and Space Shuttles 2",
		]);
		expect(fake.queries.at(1)).toMatchObject({
			query: "Dungeons Dragons Space Shuttles",
			classId: 4471,
			pageSize: 20,
		});
	});

	test("searches a pasted project page by its slug words", async () => {
		const fake = catalog({
			"dungeons dragons and space shuttles 2": [
				"Dungeons, Dragons and Space Shuttles 2",
			],
		});

		const result = await curseforgeSearchPage(fake, {
			query: "https://www.curseforge.com/minecraft/modpacks/dungeons-dragons-and-space-shuttles-2",
			index: 0,
		});

		expect(result.data.length).toBe(1);
		expect(fake.queries.at(0)?.query).toBe("dungeons dragons and space shuttles 2");
	});

	test("does not retry a later page, an empty query, or a title that is already relaxed", async () => {
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
