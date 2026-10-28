import type { Bridge } from "@serverkgg/bridge";
import { PLUGIN_VARIANTS, type ServerVariant, variantOf } from "./variant";

export const VANILLA_NAMESPACE = "minecraft";

export const vanillaCommandOf = (variant: ServerVariant, command: string) => {
	if (!PLUGIN_VARIANTS.includes(variant)) {
		return command;
	}

	return `${VANILLA_NAMESPACE}:${command}`;
};

export const vanillaCommand = async (
	context: Bridge.Context,
	command: string,
	options?: Parameters<Bridge.Context["command"]>[1],
) => {
	return await context.command(vanillaCommandOf(variantOf(context), command), options);
};
