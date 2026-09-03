import type { Bridge } from "@serverkgg/bridge";
import { MOD_VARIANTS, type ServerVariant, variantOf } from "./variant";

export const DISABLED_SUFFIX = ".disabled";

export const addonDirectoryFor = (variant: ServerVariant) => {
	return MOD_VARIANTS.includes(variant) ? "mods" : "plugins";
};

export const addonDirectory = (context: Bridge.Context) => {
	return addonDirectoryFor(variantOf(context));
};

export const fileNameOf = (path: string) => {
	return path.split("/").at(-1) ?? path;
};

export const enabledName = (filename: string) => {
	return filename.endsWith(DISABLED_SUFFIX) ? filename.slice(0, -DISABLED_SUFFIX.length) : filename;
};
