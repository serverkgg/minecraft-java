import type { Bridge } from "@serverkgg/bridge";
import { MOD_VARIANTS, variantOf } from "./variant";

export const DISABLED_SUFFIX = ".disabled";

export const addonDirectory = (context: Bridge.Context) => {
	return MOD_VARIANTS.includes(variantOf(context)) ? "mods" : "plugins";
};

export const fileNameOf = (path: string) => {
	return path.split("/").at(-1) ?? path;
};

export const enabledName = (filename: string) => {
	return filename.endsWith(DISABLED_SUFFIX) ? filename.slice(0, -DISABLED_SUFFIX.length) : filename;
};
