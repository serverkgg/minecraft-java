import { type Bridge, BridgeKind } from "@serverkgg/bridge";

export const serverType: Bridge.Options = {
	kind: BridgeKind.Options,
	async list() {
		return [
			{
				value: "vanilla",
				label: {
					ar: "Vanilla",
					en: "Vanilla",
				},
				help: {
					ar: "سيرفر Mojang الأصلي دون أي تعديل.",
					en: "Mojang's unmodified server.",
				},
			},
			{
				value: "paper",
				label: {
					ar: "Paper",
					en: "Paper",
				},
				help: {
					ar: "الأفضل للأداء والإضافات.",
					en: "Best performance and plugin support.",
				},
			},
			{
				value: "purpur",
				label: {
					ar: "Purpur",
					en: "Purpur",
				},
				help: {
					ar: "Paper مع إعدادات إضافية للتحكم الدقيق.",
					en: "Paper plus extra settings for fine-grained control.",
				},
			},
			{
				value: "fabric",
				label: {
					ar: "Fabric",
					en: "Fabric",
				},
				help: {
					ar: "للمودات الخفيفة والسريعة.",
					en: "For lightweight, fast mods.",
				},
			},
			{
				value: "neoforge",
				label: {
					ar: "NeoForge",
					en: "NeoForge",
				},
				help: {
					ar: "الخيار الأفضل للمودات حاليًا، ومعظم المودات الجديدة مبنية عليه.",
					en: "The best pick for mods today. Most new mods target it.",
				},
			},
			{
				value: "forge",
				label: {
					ar: "Forge",
					en: "Forge",
				},
				help: {
					ar: "للمودات والمودباكات القديمة.",
					en: "For older mods and modpacks.",
				},
			},
		];
	},
};
