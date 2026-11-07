import { describe, expect, it } from "bun:test";
import { ServerVariant } from "../shared";
import { memoryContext } from "../testing";
import { modrinthProvider } from "./modrinth";
import { AddonKind, type AddonTarget } from "./provider";

const FABRIC: AddonTarget = {
	kind: AddonKind.Mod,
	variant: ServerVariant.Fabric,
	gameVersion: "1.21.1",
	directory: "mods",
};

const searchedUrl = async (query: string) => {
	const urls: string[] = [];
	const { context } = memoryContext({
		json: (url) => {
			urls.push(url);

			return {
				hits: [],
				total_hits: 0,
			};
		},
	});

	await modrinthProvider.search(context, FABRIC, {
		query,
		page: 0,
		pageSize: 20,
		category: null,
		sort: null,
	});

	return new URL(urls.at(0) ?? "");
};

describe("searching modrinth from the addon catalog", () => {
	it("searches a pasted project link by its slug, with the facets a typed search sends", async () => {
		const pasted = await searchedUrl("https://modrinth.com/mod/c2me-fabric");
		const typed = await searchedUrl("c2me-fabric");

		expect(pasted.searchParams.get("query")).toBe("c2me-fabric");
		expect(pasted.toString()).toBe(typed.toString());
	});

	it("sends typed text and a link to another site as they are", async () => {
		const elsewhere = "https://www.curseforge.com/minecraft/mc-mods/amw";

		expect((await searchedUrl("sodium")).searchParams.get("query")).toBe("sodium");
		expect((await searchedUrl(elsewhere)).searchParams.get("query")).toBe(elsewhere);
	});
});
