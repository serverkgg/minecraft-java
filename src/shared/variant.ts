import type { Bridge } from "@serverkgg/bridge";

export enum ServerVariant {
	Fabric = "fabric",
	Forge = "forge",
	NeoForge = "neoforge",
	Paper = "paper",
	Purpur = "purpur",
	Vanilla = "vanilla",
}

export const PLUGIN_VARIANTS = [
	ServerVariant.Paper,
	ServerVariant.Purpur,
];

export const MOD_VARIANTS = [
	ServerVariant.Fabric,
	ServerVariant.Forge,
	ServerVariant.NeoForge,
];

export const LOADER_VARIANTS = [
	...PLUGIN_VARIANTS,
	...MOD_VARIANTS,
];

export const VARIANT_LABELS: Record<ServerVariant, string> = {
	[ServerVariant.Fabric]: "Fabric",
	[ServerVariant.Forge]: "Forge",
	[ServerVariant.NeoForge]: "NeoForge",
	[ServerVariant.Paper]: "Paper",
	[ServerVariant.Purpur]: "Purpur",
	[ServerVariant.Vanilla]: "Vanilla",
};

const VARIANTS = new Set<string>(Object.values(ServerVariant));

export const variantFrom = (declared: string | null): ServerVariant => {
	const value = declared ?? "";

	return VARIANTS.has(value) ? (value as ServerVariant) : ServerVariant.Vanilla;
};

export const variantOf = (context: Bridge.Context): ServerVariant => {
	return variantFrom(context.variable("SERVER_TYPE"));
};
