import { type ClientPackIdentity, clientPackVariant } from "./clientPackIdentity";

export const CLIENT_PACK_MODLIST = "modlist.html";

export const CLIENT_PACK_AUTHOR = "Serverk";

const MANIFEST_TYPE = "minecraftModpack";

const MANIFEST_VERSION = 1;

const OVERRIDES = "overrides";

const CURSEFORGE_PROJECT_PAGE = "https://www.curseforge.com/projects";

const WEB_PROTOCOLS = new Set([
	"https:",
	"http:",
]);

const HTML_ENTITIES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#39;",
};

const HTML_SPECIAL = /[&<>"']/g;

export interface ClientPackCurseforgeMod {
	fileName: string;
	title: string;
	projectId: number;
	fileId: number;
	pageUrl: string | null;
}

export interface ClientPackManifestText {
	manifest: string;
	modlist: string;
}

const escapeHtml = (value: string) => {
	return value.replace(HTML_SPECIAL, (character) => HTML_ENTITIES[character] ?? character);
};

const isWebPage = (value: string) => {
	return URL.canParse(value) && WEB_PROTOCOLS.has(new URL(value).protocol);
};

const modPage = (mod: ClientPackCurseforgeMod) => {
	return mod.pageUrl !== null && isWebPage(mod.pageUrl) ? mod.pageUrl : `${CURSEFORGE_PROJECT_PAGE}/${mod.projectId}`;
};

const modlistItem = (mod: ClientPackCurseforgeMod) => {
	return `<li><a href="${escapeHtml(modPage(mod))}">${escapeHtml(mod.title)}</a></li>`;
};

export const clientPackManifest = (
	identity: ClientPackIdentity,
	mods: ClientPackCurseforgeMod[],
): ClientPackManifestText => {
	const variant = clientPackVariant(identity);

	const sorted = [
		...mods,
	].sort((left, right) => left.fileName.localeCompare(right.fileName));

	const manifest = {
		minecraft: {
			version: identity.mcVersion,
			modLoaders: [
				{
					id: `${variant}-${identity.loaderVersion}`,
					primary: true,
				},
			],
		},
		manifestType: MANIFEST_TYPE,
		manifestVersion: MANIFEST_VERSION,
		name: identity.name,
		version: identity.version,
		author: CLIENT_PACK_AUTHOR,
		files: sorted.map((mod) => {
			return {
				projectID: mod.projectId,
				fileID: mod.fileId,
				required: true,
			};
		}),
		overrides: OVERRIDES,
	};

	return {
		manifest: JSON.stringify(manifest, null, 2),
		modlist: [
			"<ul>",
			...sorted.map(modlistItem),
			"</ul>",
			"",
		].join("\n"),
	};
};
