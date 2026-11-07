import { CatalogProviderId } from "./provider";

const LINK_HOSTS: Record<string, CatalogProviderId> = {
	"curseforge.com": CatalogProviderId.CurseForge,
	"www.curseforge.com": CatalogProviderId.CurseForge,
	"legacy.curseforge.com": CatalogProviderId.CurseForge,
	"beta.curseforge.com": CatalogProviderId.CurseForge,
	"modrinth.com": CatalogProviderId.Modrinth,
};

export const providerOfLink = (text: string): CatalogProviderId | null => {
	const link = text.trim();

	if (!URL.canParse(link)) {
		return null;
	}

	return LINK_HOSTS[new URL(link).hostname] ?? null;
};
