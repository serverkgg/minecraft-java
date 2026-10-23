import { BridgeUserError } from "@serverkgg/bridge";
import { MOD_VARIANTS, type ServerVariant, VARIANT_LABELS } from "../shared";

export type ClientPackVariant = ServerVariant.Fabric | ServerVariant.Forge | ServerVariant.NeoForge;

export interface ClientPackIdentity {
	name: string;
	version: string;
	mcVersion: string;
	variant: ServerVariant;
	loaderVersion: string;
}

const isClientPackVariant = (variant: ServerVariant): variant is ClientPackVariant => {
	return MOD_VARIANTS.includes(variant);
};

export const clientPackVariant = (identity: ClientPackIdentity): ClientPackVariant => {
	if (!isClientPackVariant(identity.variant)) {
		const label = VARIANT_LABELS[identity.variant];

		throw new BridgeUserError({
			ar: `سيرفر ${label} لا يشغّل مودات، ولذلك لا يمكن تجهيز مودباك منه. المودباك متاح لسيرفرات Fabric و Forge و NeoForge.`,
			en: `A ${label} server runs no mods, so we can't build a modpack from it. Modpacks are for Fabric, Forge and NeoForge servers.`,
		});
	}

	if (identity.mcVersion.length === 0 || identity.loaderVersion.length === 0) {
		throw new Error("a client pack needs both the minecraft version and the loader version");
	}

	return identity.variant;
};
