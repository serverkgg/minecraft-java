import { BridgeUserError } from "@serverkgg/bridge";
import { modPath } from "../modpacks";
import { ServerVariant } from "../shared";
import { type ClientPackIdentity, type ClientPackVariant, clientPackVariant } from "./clientPackIdentity";

const FORMAT_VERSION = 1;

const GAME = "minecraft";

const REQUIRED = "required";

const PATH_SEPARATORS = [
	"/",
	"\\",
];

const RELATIVE_NAMES = [
	".",
	"..",
];

const LOADER_DEPENDENCIES: Record<ClientPackVariant, string> = {
	[ServerVariant.Fabric]: "fabric-loader",
	[ServerVariant.Forge]: "forge",
	[ServerVariant.NeoForge]: "neoforge",
};

export interface ClientPackIndexIdentity extends ClientPackIdentity {
	summary?: string;
}

export interface ClientPackModrinthMod {
	fileName: string;
	sha1: string;
	sha512: string;
	sizeBytes: number;
	url: string;
}

const isPlainFileName = (fileName: string) => {
	return (
		fileName.length > 0
		&& !RELATIVE_NAMES.includes(fileName)
		&& !PATH_SEPARATORS.some((separator) => fileName.includes(separator))
	);
};

const indexPath = (fileName: string) => {
	if (!isPlainFileName(fileName)) {
		throw new BridgeUserError({
			ar: `تعذّر وضع الملف «${fileName}» في المودباك لأن اسمه غير صالح. غيّر اسمه في مجلد mods، ثم جرب مرة ثانية.`,
			en: `We couldn't put "${fileName}" in the modpack because its name isn't valid. Rename it in the mods folder, then try again.`,
		});
	}

	return modPath(fileName);
};

const indexFile = (mod: ClientPackModrinthMod) => {
	return {
		path: indexPath(mod.fileName),
		hashes: {
			sha1: mod.sha1,
			sha512: mod.sha512,
		},
		env: {
			client: REQUIRED,
			server: REQUIRED,
		},
		downloads: [
			mod.url,
		],
		fileSize: mod.sizeBytes,
	};
};

export const clientPackIndex = (identity: ClientPackIndexIdentity, mods: ClientPackModrinthMod[]): string => {
	const variant = clientPackVariant(identity);

	const files = mods.map(indexFile).sort((left, right) => left.path.localeCompare(right.path));

	const index = {
		formatVersion: FORMAT_VERSION,
		game: GAME,
		versionId: identity.version,
		name: identity.name,
		...(identity.summary
			? {
					summary: identity.summary,
				}
			: {}),
		files,
		dependencies: {
			minecraft: identity.mcVersion,
			[LOADER_DEPENDENCIES[variant]]: identity.loaderVersion,
		},
	};

	return JSON.stringify(index, null, 2);
};
