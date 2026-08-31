const CLIENT_ONLY_NAMES = [
	"3dskinlayers",
	"ae2-emi-crafting",
	"ambientsounds",
	"amecs",
	"animation_overhaul",
	"auudio",
	"axolotlbuckets",
	"badoptimizations",
	"betteradvancements",
	"betterbeds",
	"betterf3",
	"bettergrassify",
	"betterthirdperson",
	"bhmenu",
	"blur",
	"boat-item-view",
	"bobby",
	"cat_jam",
	"chat_heads",
	"chatanimation",
	"cherishedworlds",
	"citresewn",
	"clickadv",
	"cobblemon-ui-tweaks",
	"colorwheel",
	"compass-coords",
	"connectedness",
	"continuity",
	"controlling",
	"craftpresence",
	"crashassistant",
	"cull less leaves",
	"cwb",
	"disablecustomworldsadvice",
	"distraction_free_recipes",
	"drippyloadingscreen",
	"eating-animation",
	"emi_trade",
	"emiffect",
	"emitrades",
	"entity_model_features",
	"entity_texture_features",
	"entityculling",
	"euphoriapatcher",
	"fallingleaves",
	"fancymenu",
	"fast-ip-ping",
	"fastquit",
	"feytweaks",
	"forgeconfigscreens",
	"geckolibiriscompat",
	"gpumemleakfix",
	"highlighter",
	"immediatelyfast",
	"immersivedamageindicators",
	"indium",
	"inventory-profiles-next",
	"iris",
	"iris-flywheel",
	"itemborders",
	"itemlocks",
	"justzoom",
	"language-reload",
	"lazy-language-loader",
	"legendarytooltips",
	"loadmyresources",
	"lootbeams",
	"mindfuldarkness",
	"miningspeedtooltips",
	"mousetweaks",
	"nicer-skies",
	"notenoughanimations",
	"oculus",
	"ok_zoomer",
	"overflowingbars",
	"particlerain",
	"pickupnotifier",
	"presencefootsteps",
	"prism",
	"reeses_sodium_options",
	"reforgium",
	"resourcepackoverrides",
	"roughly-enough-items",
	"ryoamiclights",
	"screenshot_viewer",
	"searchables",
	"seasonhud",
	"shouldersurfing",
	"skinlayers3d",
	"smoothswapping",
	"sodium",
	"sorted_enchantments",
	"tooltipfix",
	"visuality",
	"vr-combat",
	"wailastages",
	"welcomescreen",
	"xaeros_minimap",
	"xaerosworldmap",
	"yeetusexperimentus",
	"yungsmenutweaks",
	"zoomify",
	"zume",
];

const CLIENT_ONLY_PATTERNS = [
	/(^|\/)figura-/i,
];

export const CLIENT_ONLY_DIRECTORIES = [
	"shaderpacks",
	"resourcepacks",
];

export const fileNameOf = (path: string) => {
	return path.split("/").at(-1) ?? path;
};

const startsToken = (name: string, entry: string) => {
	let index = name.indexOf(entry);

	while (index >= 0) {
		if (index === 0 || !/[a-z0-9]/.test(name.charAt(index - 1))) {
			return true;
		}

		index = name.indexOf(entry, index + 1);
	}

	return false;
};

export const isClientOnlyFilename = (filename: string) => {
	const name = filename.toLowerCase();

	return (
		CLIENT_ONLY_NAMES.some((entry) => startsToken(name, entry))
		|| CLIENT_ONLY_PATTERNS.some((pattern) => pattern.test(filename))
	);
};

export const isClientOnlyPath = (path: string) => {
	const directory = path.split("/").at(0)?.toLowerCase() ?? "";

	return CLIENT_ONLY_DIRECTORIES.includes(directory) || isClientOnlyFilename(fileNameOf(path));
};
