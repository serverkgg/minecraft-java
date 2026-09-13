import { expect, test } from "bun:test";
import type { CatalogDependency, CatalogRelease } from "../providers";
import { resolveDependencies } from "./dependencies";

const required = (project: string, version: string | null = null): CatalogDependency => ({
	project,
	version,
	kind: "required",
});
const release = (versionId: string, dependencies: CatalogDependency[] = []): CatalogRelease => ({
	versionId,
	version: versionId,
	title: versionId,
	icon: null,
	pageUrl: null,
	gameVersions: null,
	loaders: null,
	serverSide: null,
	file: {
		filename: `${versionId}.jar`,
		url: "https://example.com/file",
		digest: null,
		sizeBytes: null,
	},
	dependencies,
});

test("resolves transitive dependencies beyond the old eight-file limit and terminates cycles", async () => {
	const result = await resolveDependencies("0", async (project) =>
		release(project, [
			required(String((Number(project) + 1) % 12)),
		]),
	);
	expect(result).toHaveLength(12);
});

test("uses exact dependency versions instead of silently selecting latest", async () => {
	const calls: (string | null)[] = [];
	const result = await resolveDependencies("root", async (project, version) => {
		calls.push(version);
		return project === "root"
			? release("root", [
					required("library", "pinned"),
				])
			: release(version ?? "latest");
	});
	expect(calls).toEqual([
		null,
		"pinned",
	]);
	expect(result[1]?.release.versionId).toBe("pinned");
});

test("refuses missing required dependencies", async () => {
	await expect(
		resolveDependencies("root", async (project) =>
			project === "root"
				? release("root", [
						required("missing"),
					])
				: null,
		),
	).rejects.toThrow();
});

test("refuses incompatible projects and conflicting exact releases", async () => {
	await expect(
		resolveDependencies("root", async (project) =>
			release(
				project,
				project === "root"
					? [
							required("library", "one"),
							required("library", "two"),
						]
					: [],
			),
		),
	).rejects.toThrow();
	await expect(
		resolveDependencies("root", async (project) =>
			release(
				project,
				project === "root"
					? [
							required("library"),
							{
								project: "library",
								version: null,
								kind: "incompatible",
							},
						]
					: [],
			),
		),
	).rejects.toThrow();
});

test("does not install optional or embedded dependencies", async () => {
	const result = await resolveDependencies("root", async () =>
		release("root", [
			{
				project: "optional",
				version: null,
				kind: "optional",
			},
			{
				project: "embedded",
				version: null,
				kind: "embedded",
			},
		]),
	);
	expect(result).toHaveLength(1);
});
