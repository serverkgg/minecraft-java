import { fileNameOf } from "../shared";

export const SERVER_SAFE_NAMES = [
	"appleskin",
	"ping-wheel",
	"pingwheel",
	"thulium",
];

export const CLIENT_ONLY_NAMES = [
	"3dskinlayers",
	"ae2-emi-crafting",
	"ambientsounds",
	"amecs",
	"animation_overhaul",
	"armorchroma",
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
	"catalogue",
	"chat_heads",
	"chatanimation",
	"cherishedworlds",
	"citresewn",
	"clickadv",
	"cobblemon-ui-tweaks",
	"colorwheel",
	"compass-coords",
	"configured",
	"connectedness",
	"continuity",
	"controllable",
	"controlling",
	"craftpresence",
	"crash_assistant",
	"crashassistant",
	"cullleaves",
	"culllessleaves",
	"customdiscordrpc",
	"cwb",
	"dashloader",
	"defaultoptions",
	"disablecustomworldsadvice",
	"distraction_free_recipes",
	"drippyloadingscreen",
	"eatinganimation",
	"embeddium",
	"emi_trade",
	"emiffect",
	"emitrades",
	"entity-texture-features",
	"entity_model_features",
	"entity_texture_features",
	"entityculling",
	"essential_",
	"euphoriapatcher",
	"fallingleaves",
	"fancymenu",
	"fast-ip-ping",
	"fastquit",
	"feytweaks",
	"forgeconfigscreens",
	"freecam",
	"geckolibiriscompat",
	"gpumemleakfix",
	"highlighter",
	"immediatelyfast",
	"immersivedamageindicators",
	"indium",
	"inventoryhud",
	"inventoryprofiles",
	"iris",
	"iris-flywheel",
	"itemborders",
	"itemlocks",
	"justzoom",
	"language-reload",
	"lazy-language-loader",
	"lazydfu",
	"legendarytooltips",
	"libipn",
	"litematica",
	"loadmyresources",
	"lootbeams",
	"mindfuldarkness",
	"minihud",
	"miningspeedtooltips",
	"missingmodschecker",
	"moreoverlays",
	"mousetweaks",
	"mousewheelie",
	"nicer-skies",
	"notenoughanimations",
	"oculus",
	"ok_zoomer",
	"optigui",
	"overflowingbars",
	"overloadedarmorbar",
	"particle-rain",
	"particlerain",
	"physics-mod",
	"physicsmod",
	"pickupnotifier",
	"presencefootsteps",
	"prism",
	"rebind_narrator",
	"reeses_sodium_options",
	"reforgium",
	"resourcepackoverrides",
	"roughlyenoughitems",
	"rubidium",
	"ryoamiclights",
	"screenshot_viewer",
	"searchables",
	"seasonhud",
	"shouldersurfing",
	"simple-rpc",
	"skinlayers3d",
	"smoothboot",
	"smoothswapping",
	"sodium",
	"sorted_enchantments",
	"textrues_embeddium_options",
	"tooltipfix",
	"torohealth",
	"toughnessbar",
	"tweakeroo",
	"visuality",
	"vr-combat",
	"wailastages",
	"wakes",
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

export const isServerSafeFilename = (filename: string) => {
	const name = filename.toLowerCase();

	return SERVER_SAFE_NAMES.some((entry) => startsToken(name, entry));
};

export const isClientOnlyFilename = (filename: string) => {
	if (isServerSafeFilename(filename)) {
		return false;
	}

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
