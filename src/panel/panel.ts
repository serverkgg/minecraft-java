import {
	type Bridge,
	BridgeConfirm,
	BridgeControl,
	BridgeFormTarget,
	BridgeIcon,
	BridgeLayout,
	BridgePlace,
} from "@serverkgg/bridge";
import { rconAccessSections } from "@serverkgg/bridge/rcon";
import { CROSSPLAY, VERSION_COMPAT } from "../companions";
import { MODPACK_UPDATE_ACTION, MODPACK_VARIABLE } from "../modpacks";
import {
	CHAT_MESSAGE_LENGTH,
	DIFFICULTY_OPTIONS,
	GAME_MODE_OPTIONS,
	WORLD_STAGING,
	XP_MAX_LEVELS,
	XP_MIN_LEVELS,
} from "../shared";

const LOADER_TYPES = [
	"paper",
	"purpur",
	"fabric",
	"forge",
	"neoforge",
];

const MESSAGE_FIELD: Bridge.Field = {
	key: "message",
	control: BridgeControl.Text,
	label: {
		ar: "الرسالة",
		en: "Message",
	},
	maxLength: CHAT_MESSAGE_LENGTH,
};

const modpackStatusSection: Bridge.Section = {
	layout: BridgeLayout.Detail,
	id: "modpack-status",
	title: {
		ar: "سيرفرك على مودباك",
		en: "Running a modpack",
	},
	module: "modpackStatus",
	reinstall: true,
	variable: MODPACK_VARIABLE,
	confirm: BridgeConfirm.Strong,
	confirmText: {
		ar: "إزالة المودباك تحذفه مع موداته، وتبقى الماب التي بنيتها عليه محفوظة باسم جديد في تبويب المابات، ويعود سيرفرك إلى النوع والإصدار نفسيهما دون مودباك وبماب جديدة. يبقى ما ثبّته بنفسك.",
		en: "Removing the modpack deletes it and its mods, keeps the world you built on it under a new name in the Worlds tab, and leaves your server on the same type and version without a modpack and with a fresh world. Anything you installed yourself stays.",
	},
	actions: [
		{
			id: MODPACK_UPDATE_ACTION,
			label: {
				ar: "حدّث المودباك",
				en: "Update modpack",
			},
			confirm: BridgeConfirm.Strong,
			confirmText: {
				ar: "نثبّت آخر إصدار من المودباك نفسه. تبقى مابك إذا كان الإصدار الجديد على النوع نفسه وعلى إصدار ماينكرافت نفسه أو أحدث.",
				en: "We install the latest release of the same pack. Your world stays as long as the new release is on the same type and the same version or newer.",
			},
		},
	],
	related: {
		tab: "modpacks",
		label: {
			ar: "تصفّح المودباكات",
			en: "Browse modpacks",
		},
	},
	empty: {
		ar: "لم يكتمل تثبيت المودباك بعد. افتح تبويب المودباك لمتابعة التقدم.",
		en: "The modpack isn't installed yet. Open the Modpacks tab to see where it stands.",
	},
	visibleWhen: {
		variable: MODPACK_VARIABLE,
		empty: false,
	},
};

const versionTab: Bridge.Tab = {
	id: "version",
	title: {
		ar: "الإصدار",
		en: "Version",
	},
	icon: BridgeIcon.Tag,
	sections: [
		modpackStatusSection,
		{
			layout: BridgeLayout.Form,
			id: "version",
			help: {
				ar: "غيّر نوع سيرفرك أو إصداره، ونثبّته لك من جديد على ما تختاره.",
				en: "Change your server's type or version and we reinstall it on what you pick.",
			},
			target: BridgeFormTarget.Variables,
			module: "version",
			reinstall: true,
			confirm: BridgeConfirm.Strong,
			confirmText: {
				ar: "حسب التغيير، إما أن تبقى مابك في مكانها، أو ننقل ملفاتها إلى المكان الجديد، أو يُفقد كل ما أضافته المودات إليها. والرجوع إلى إصدار أقدم يبدأ ماب جديدة دائمًا.",
				en: "Depending on the change, your world may stay where it is, be moved into place, or lose what mods added to it. Going back to an older version always starts a fresh world.",
			},
			preview: {
				module: "transitionPreview",
			},
			fields: [
				{
					key: "SERVER_TYPE",
					control: BridgeControl.Select,
					label: {
						ar: "نوع السيرفر",
						en: "Server type",
					},
					help: {
						ar: "غيّر النوع إذا أردت إضافات أو مودات.",
						en: "Switch type for plugins or mods.",
					},
					options: {
						module: "serverType",
					},
				},
				{
					key: "MC_VERSION",
					control: BridgeControl.Select,
					label: {
						ar: "إصدار ماينكرافت",
						en: "Minecraft version",
					},
					help: {
						ar: "اتركه فارغًا لتبقى على إصدارك الحالي (وعلى آخر إصدار في السيرفر الجديد)، أو اختر إصدارًا لتغييره.",
						en: "Leave it empty to keep the version you're on (the latest release on a fresh server), or pick one to change it.",
					},
					options: {
						module: "gameVersion",
					},
				},
				{
					key: "LOADER_VERSION",
					control: BridgeControl.Select,
					label: {
						ar: "إصدار المشغّل",
						en: "Loader build",
					},
					help: {
						ar: "اتركه فارغًا لتبقى على المشغّل الحالي، أو اختر إصدارًا محددًا للتحديث.",
						en: "Leave it empty to keep the installed loader, or pick a specific build to update.",
					},
					options: {
						module: "loaderBuild",
					},
					visibleWhen: {
						variable: "SERVER_TYPE",
						values: LOADER_TYPES,
					},
				},
			],
			clears: [
				{
					variable: MODPACK_VARIABLE,
					warning: {
						ar: "سيرفرك على مودباك. أي تغيير هنا يزيل المودباك وموداته، ويحفظ الماب التي بنيتها عليه باسم جديد في تبويب المابات، ويعيد سيرفرك إلى النوع والإصدار اللذين تختارهما بماب جديدة.",
						en: "Your server runs a modpack. Any change here removes the pack and its mods, keeps the world you built on it under a new name in the Worlds tab, and puts your server on the type and version you pick with a fresh world.",
					},
				},
			],
		},
	],
};

const modpacksTab: Bridge.Tab = {
	id: "modpacks",
	title: {
		ar: "المودباك",
		en: "Modpacks",
	},
	icon: BridgeIcon.Box,
	sections: [
		{
			layout: BridgeLayout.Catalog,
			id: "modpack-list",
			module: "modpacks",
			reinstall: true,
			variable: MODPACK_VARIABLE,
			confirm: BridgeConfirm.Strong,
			confirmText: {
				ar: "تثبيت المودباك يعيد بناء سيرفرك: يحذف مجلدات المودات والإعدادات بالكامل، بما فيها المودات التي ثبّتها بنفسك. تبقى مابك في مكانها إلا إذا تطلب المودباك إصدارًا أقدم من إصدارك، وإذا كان سيرفرك على مشغّل مودات وانتقلت منه يُفقد كل ما أضافته المودات إلى مابك. وإزالة المودباك تحذفه مع موداته، وتبقى الماب التي بنيتها عليه محفوظة باسم جديد في تبويب المابات، ويعود سيرفرك دون مودباك وبماب جديدة.",
				en: "Installing a modpack rebuilds your server: the mods and config folders are deleted, including mods you installed yourself. Your world stays unless the pack needs an older version than yours, and if you leave a mod loader everything the mods added to your world is lost. Removing the modpack takes it and its mods, keeps the world you built on it under a new name in the Worlds tab, and leaves your server without a modpack and with a fresh world.",
			},
			empty: {
				ar: "لا يوجد مودباك مثبّت. ابحث عن مودباك في الأعلى واختره، ونجهّز سيرفرك عليه.",
				en: "No modpack installed. Search for one above and pick it, and we'll set your server up for it.",
			},
		},
	],
};

const settingsTab: Bridge.Tab = {
	id: "settings",
	title: {
		ar: "الإعدادات",
		en: "Settings",
	},
	icon: BridgeIcon.Settings,
	sections: [
		{
			layout: BridgeLayout.Form,
			id: "crossplay",
			title: {
				ar: "كروس بلاي",
				en: "Crossplay",
			},
			help: {
				ar: "اسمح لأصحابك على الجوال أو الكونسول أو ويندوز بدخول سيرفرك.",
				en: "Let friends on phone, console or Windows into your server.",
			},
			target: BridgeFormTarget.Variables,
			reinstall: false,
			confirm: BridgeConfirm.Normal,
			confirmText: {
				ar: "عند حفظ التغيير يتم ريستارت سيرفرك فورًا لتطبيق التعديل.",
				en: "Saving restarts your server right away so the change takes effect.",
			},
			fields: [
				{
					key: "CROSSPLAY",
					control: BridgeControl.Boolean,
					label: {
						ar: "دخول لاعبي بيدروك",
						en: "Let Bedrock players in",
					},
					help: {
						ar: "نثبّت Geyser و Floodgate ونحدّثهما لك. بعد التفعيل يظهر عنوان بيدروك في صفحة سيرفرك، ويدخل منه أصحابك على الجوال أو الكونسول أو ويندوز، وتبدأ أسماؤهم داخل اللعبة بنقطة.",
						en: "We install and update Geyser and Floodgate for you. The Bedrock address appears on your server page once crossplay is on, friends on phone, console or Windows join on it, and their in-game names start with a dot.",
					},
					warning: {
						ar: "يستهلك الكروس بلاي رامًا إضافيًا. إذا كان رام سيرفرك 1GB فقط فتوقع حدوث لاق.",
						en: "Crossplay needs extra RAM. On a 1GB server, expect lag.",
					},
				},
			],
			visibleWhen: {
				variable: "SERVER_TYPE",
				values: CROSSPLAY.variants,
			},
		},
		{
			layout: BridgeLayout.Form,
			id: "version-compat",
			title: {
				ar: "توافق الإصدارات",
				en: "Version compatibility",
			},
			help: {
				ar: "اسمح لأصحابك بدخول سيرفرك بإصدار جافا مختلف عن إصداره.",
				en: "Let friends join your server on a Java version other than its own.",
			},
			target: BridgeFormTarget.Variables,
			reinstall: false,
			confirm: BridgeConfirm.Normal,
			confirmText: {
				ar: "عند حفظ التغيير يتم ريستارت سيرفرك فورًا لتطبيق التعديل.",
				en: "Saving restarts your server right away so the change takes effect.",
			},
			fields: [
				{
					key: "VERSION_COMPAT",
					control: BridgeControl.Boolean,
					label: {
						ar: "دخول إصدارات جافا الأخرى",
						en: "Let other Java versions in",
					},
					help: {
						ar: "نثبّت ViaVersion و ViaBackwards ونحدّثهما لك. يدخل أصحابك سيرفرك بإصدار جافا أحدث أو أقدم من إصدار سيرفرك، دون أي تغيير من جهتهم.",
						en: "We install and update ViaVersion and ViaBackwards for you. Friends join on a Java version newer or older than your server, with nothing to change on their side.",
					},
					warning: {
						ar: "البلوكات والأغراض التي أُضيفت في الإصدارات الجديدة تظهر ناقصة أو بشكل غير صحيح لمن يدخل بإصدار أقدم.",
						en: "Blocks and items added in newer versions look wrong or go missing for players on an older version.",
					},
				},
			],
			visibleWhen: {
				variable: "SERVER_TYPE",
				values: VERSION_COMPAT.variants,
			},
		},
		{
			layout: BridgeLayout.Form,
			id: "settings",
			help: {
				ar: "إعدادات اللعبة نفسها، وتُحفظ في ملف server.properties.",
				en: "The game's own settings, written into server.properties.",
			},
			target: BridgeFormTarget.Settings,
			module: "settings",
			restartHint: true,
			fields: [
				{
					key: "motd",
					control: BridgeControl.Text,
					label: {
						ar: "رسالة السيرفر",
						en: "MOTD",
					},
					help: {
						ar: "النص الذي يظهر للاعبين في قائمة السيرفرات.",
						en: "Shown to players in the server list.",
					},
					maxLength: 59,
				},
				{
					key: "max-players",
					control: BridgeControl.Number,
					label: {
						ar: "أقصى عدد لاعبين",
						en: "Max players",
					},
					min: 1,
					max: 200,
				},
				{
					key: "gamemode",
					control: BridgeControl.Select,
					label: {
						ar: "وضع اللعب",
						en: "Game mode",
					},
					options: GAME_MODE_OPTIONS,
				},
				{
					key: "difficulty",
					control: BridgeControl.Select,
					label: {
						ar: "الصعوبة",
						en: "Difficulty",
					},
					options: DIFFICULTY_OPTIONS,
				},
				{
					key: "pvp",
					control: BridgeControl.Boolean,
					label: {
						ar: "قتال اللاعبين (PvP)",
						en: "PvP",
					},
				},
				{
					key: "online-mode",
					control: BridgeControl.Boolean,
					label: {
						ar: "الحسابات الأصلية فقط",
						en: "Online mode",
					},
					warning: {
						ar: "إيقافه يسمح للنسخ غير الأصلية بالدخول ويقلل أمان سيرفرك.",
						en: "Disabling this allows cracked clients and reduces your server's security.",
					},
				},
				{
					key: "white-list",
					control: BridgeControl.Boolean,
					label: {
						ar: "القائمة البيضاء",
						en: "Whitelist",
					},
					help: {
						ar: "عند تفعيلها، لا يدخل إلا اللاعبون الذين تضيفهم بنفسك.",
						en: "When on, only players you add can join.",
					},
				},
				{
					key: "view-distance",
					control: BridgeControl.Slider,
					label: {
						ar: "مدى الرؤية",
						en: "View distance",
					},
					help: {
						ar: "كلما زاد، زاد استهلاك المعالج والرام.",
						en: "Higher values cost more CPU and RAM.",
					},
					min: 3,
					max: 32,
				},
				{
					key: "simulation-distance",
					control: BridgeControl.Slider,
					label: {
						ar: "مدى المحاكاة",
						en: "Simulation distance",
					},
					min: 3,
					max: 32,
				},
				{
					key: "spawn-protection",
					control: BridgeControl.Number,
					label: {
						ar: "حماية نقطة البداية",
						en: "Spawn protection",
					},
					min: 0,
					max: 256,
				},
				{
					key: "level-seed",
					control: BridgeControl.Text,
					label: {
						ar: "سيد الماب",
						en: "World seed",
					},
					help: {
						ar: "اتركه فارغًا لماب عشوائية. تغييره لا يؤثر على ماب موجودة.",
						en: "Leave it empty for a random world. Changing it doesn't affect an existing world.",
					},
				},
				{
					key: "allow-flight",
					control: BridgeControl.Boolean,
					label: {
						ar: "السماح بالطيران",
						en: "Allow flight",
					},
				},
				{
					key: "enable-command-block",
					control: BridgeControl.Boolean,
					label: {
						ar: "تفعيل بلوك الأوامر",
						en: "Command blocks",
					},
				},
			],
		},
		...rconAccessSections(),
	],
};

const playersTab: Bridge.Tab = {
	id: "players",
	title: {
		ar: "اللاعبون",
		en: "Players",
	},
	icon: BridgeIcon.Users,
	sections: [
		{
			layout: BridgeLayout.Table,
			id: "players",
			title: {
				ar: "المتصلون حاليًا",
				en: "Online now",
			},
			place: BridgePlace.Players,
			module: "players",
			columns: [
				{
					key: "name",
					label: {
						ar: "اللاعب",
						en: "Player",
					},
				},
			],
			actions: [
				{
					id: "kick",
					label: {
						ar: "اطرد",
						en: "Kick",
					},
					confirm: BridgeConfirm.Normal,
				},
				{
					id: "ban",
					label: {
						ar: "احظر",
						en: "Ban",
					},
					confirm: BridgeConfirm.Normal,
					offline: true,
				},
				{
					id: "op",
					label: {
						ar: "اجعله أدمن",
						en: "Make operator",
					},
					confirm: BridgeConfirm.Strong,
				},
				{
					id: "xp",
					label: {
						ar: "أضف خبرة",
						en: "Give XP",
					},
					fields: [
						{
							key: "amount",
							control: BridgeControl.Number,
							label: {
								ar: "عدد المستويات",
								en: "Levels",
							},
							min: XP_MIN_LEVELS,
							max: XP_MAX_LEVELS,
						},
					],
				},
				{
					id: "gamemode",
					label: {
						ar: "غيّر وضع اللعب",
						en: "Change game mode",
					},
					fields: [
						{
							key: "mode",
							control: BridgeControl.Select,
							label: {
								ar: "وضع اللعب",
								en: "Game mode",
							},
							options: GAME_MODE_OPTIONS,
						},
					],
				},
				{
					id: "kill",
					label: {
						ar: "اقتله",
						en: "Kill",
					},
					confirm: BridgeConfirm.Normal,
					confirmText: {
						ar: "يموت اللاعب داخل اللعبة ويعود إلى نقطة البداية، وتسقط أغراضه في مكانه.",
						en: "The player dies in game and respawns, dropping whatever they carried.",
					},
				},
			],
			empty: {
				ar: "لا يوجد لاعبون متصلون حاليًا.",
				en: "Nobody is online right now.",
			},
		},
		{
			layout: BridgeLayout.Table,
			id: "whitelist",
			title: {
				ar: "القائمة البيضاء",
				en: "Whitelist",
			},
			place: BridgePlace.Players,
			module: "whitelist",
			columns: [
				{
					key: "name",
					label: {
						ar: "اللاعب",
						en: "Player",
					},
				},
			],
			add: {
				label: {
					ar: "أضف لاعبًا",
					en: "Add player",
				},
				placeholder: "Steve  ·  .Gamer Tag",
			},
			actions: [
				{
					id: "remove",
					label: {
						ar: "أزل",
						en: "Remove",
					},
					confirm: BridgeConfirm.Normal,
				},
			],
			empty: {
				ar: "القائمة البيضاء فارغة. اكتب اسم لاعب جافا كما هو، واكتب اسم لاعب بيدروك مسبوقًا بنقطة مع الإبقاء على مسافاته.",
				en: "The whitelist is empty. Add a Java name as it is, and a Bedrock gamertag with a dot in front and its spaces kept.",
			},
		},
		{
			layout: BridgeLayout.Table,
			id: "bans",
			title: {
				ar: "المحظورون",
				en: "Banned players",
			},
			place: BridgePlace.Players,
			module: "bans",
			columns: [
				{
					key: "name",
					label: {
						ar: "اللاعب",
						en: "Player",
					},
				},
				{
					key: "source",
					label: {
						ar: "مصدر الحظر",
						en: "Banned by",
					},
				},
				{
					key: "reason",
					label: {
						ar: "السبب",
						en: "Reason",
					},
				},
			],
			actions: [
				{
					id: "remove",
					label: {
						ar: "فك الحظر",
						en: "Unban",
					},
					confirm: BridgeConfirm.Normal,
				},
			],
			empty: {
				ar: "لا يوجد لاعبون محظورون من سيرفرك. يظهر هنا كل لاعب تحظره من جدول المتصلين، ومن هنا تفك الحظر عنه ليتمكن من الدخول فورًا.",
				en: "Nobody is banned from your server. Anyone you ban from the online list shows up here, and this is where you lift the ban so they can join again right away.",
			},
		},
	],
};

const gameplayTab: Bridge.Tab = {
	id: "gameplay",
	title: {
		ar: "اللعب",
		en: "Gameplay",
	},
	icon: BridgeIcon.Gamepad,
	sections: [
		{
			layout: BridgeLayout.Actions,
			id: "world",
			title: {
				ar: "التحكم بالماب",
				en: "World controls",
			},
			help: {
				ar: "أوامر تُنفَّذ فورًا على سيرفرك الشغّال، وتعود إلى إعدادات السيرفر بعد الريستارت.",
				en: "These run on your server right away and fall back to its settings after a restart.",
			},
			module: "gameplay",
			actions: [
				{
					id: "timeDay",
					label: {
						ar: "اجعله نهارًا",
						en: "Set day",
					},
				},
				{
					id: "timeNight",
					label: {
						ar: "اجعله ليلًا",
						en: "Set night",
					},
				},
				{
					id: "weatherClear",
					label: {
						ar: "طقس صافٍ",
						en: "Clear weather",
					},
				},
				{
					id: "weatherRain",
					label: {
						ar: "مطر",
						en: "Rain",
					},
				},
				{
					id: "weatherThunder",
					label: {
						ar: "رعد وبرق",
						en: "Thunder",
					},
				},
				{
					id: "saveAll",
					label: {
						ar: "احفظ الماب",
						en: "Save the world",
					},
				},
				{
					id: "difficulty",
					label: {
						ar: "الصعوبة",
						en: "Difficulty",
					},
					fields: [
						{
							key: "mode",
							control: BridgeControl.Select,
							label: {
								ar: "الصعوبة",
								en: "Difficulty",
							},
							help: {
								ar: "لكي تبقى بعد الريستارت، غيّرها من الإعدادات.",
								en: "To keep it after a restart, change it in Settings.",
							},
							options: DIFFICULTY_OPTIONS,
						},
					],
				},
			],
		},
		{
			layout: BridgeLayout.Actions,
			id: "broadcast",
			title: {
				ar: "رسالة للاعبين",
				en: "Broadcast",
			},
			help: {
				ar: "تصل إلى كل اللاعبين المتصلين بالسيرفر حاليًا.",
				en: "Reaches everyone who is on the server right now.",
			},
			module: "broadcast",
			actions: [
				{
					id: "say",
					label: {
						ar: "رسالة بالشات",
						en: "Send to chat",
					},
					fields: [
						MESSAGE_FIELD,
					],
				},
				{
					id: "title",
					label: {
						ar: "رسالة على الشاشة",
						en: "Show on screen",
					},
					fields: [
						MESSAGE_FIELD,
					],
				},
			],
		},
	],
};

const worldsTab: Bridge.Tab = {
	id: "worlds",
	title: {
		ar: "المابات",
		en: "Worlds",
	},
	icon: BridgeIcon.Map,
	sections: [
		{
			layout: BridgeLayout.Actions,
			id: "world-tools",
			module: "worldTools",
			actions: [
				{
					id: "create",
					label: {
						ar: "ماب جديدة",
						en: "Create world",
					},
					confirm: BridgeConfirm.Normal,
					confirmText: {
						ar: "نجهّز ماب جديدة ونفعّلها عند التشغيل. تبقى مابك الحالية محفوظة.",
						en: "Prepare a new world and activate it on start. Your current world stays available.",
					},
					fields: [
						{
							key: "name",
							control: BridgeControl.Text,
							label: {
								ar: "اسم الماب",
								en: "World name",
							},
							maxLength: 32,
						},
						{
							key: "seed",
							control: BridgeControl.Text,
							label: {
								ar: "السيد (اختياري)",
								en: "Seed (optional)",
							},
							maxLength: 64,
						},
					],
				},
			],
		},

		{
			layout: BridgeLayout.Table,
			id: "worlds",
			module: "worlds",
			columns: [
				{
					key: "name",
					label: {
						ar: "الماب",
						en: "World",
					},
				},
				{
					key: "size",
					label: {
						ar: "الحجم",
						en: "Size",
					},
				},
				{
					key: "active",
					label: {
						ar: "المفعّلة",
						en: "Active",
					},
				},
			],
			upload: {
				label: {
					ar: "ارفع ماب",
					en: "Upload world",
				},
				extensions: [
					"zip",
				],
				staging: WORLD_STAGING,
			},
			actions: [
				{
					id: "export",
					label: {
						ar: "جهّز التنزيل",
						en: "Prepare download",
					},
					confirm: BridgeConfirm.Normal,
					confirmText: {
						ar: "نجهّز ملف ZIP يحتوي على الماب والنذر والإند، ثم اضغط «نزّل». وقّف سيرفرك أولًا إذا أردت نسخة سليمة.",
						en: "We prepare a ZIP with the world, Nether and End. Then select Download. Stop the server first if you want a clean copy.",
					},
				},

				{
					id: "clone",
					label: {
						ar: "انسخ الماب",
						en: "Copy world",
					},
					confirm: BridgeConfirm.Normal,
					fields: [
						{
							key: "name",
							control: BridgeControl.Text,
							label: {
								ar: "اسم الماب الجديدة",
								en: "New world name",
							},
							maxLength: 32,
						},
					],
				},
				{
					id: "download",
					label: {
						ar: "نزّل",
						en: "Download",
					},
					download: true,
				},
				{
					id: "activate",
					label: {
						ar: "فعّل",
						en: "Activate",
					},
					confirm: BridgeConfirm.Normal,
					confirmText: {
						ar: "نبدّل الماب في إعدادات السيرفر. إذا كان السيرفر شغّالًا فلن تُفتح الماب الجديدة إلا بعد الريستارت.",
						en: "We switch the world in the server settings. If the server is running, the new world opens only after you restart it.",
					},
				},
				{
					id: "delete",
					label: {
						ar: "احذف",
						en: "Delete",
					},
					confirm: BridgeConfirm.Strong,
					confirmText: {
						ar: "حذف الماب يزيلها مع النذر والإند الخاصين بها نهائيًا. النسخة الاحتياطية هي طريقك الوحيد للرجوع، لذلك خذ نسخة احتياطية قبل المتابعة.",
						en: "Deleting a world removes it with its Nether and End for good. A backup is your only way back, so take one before you continue.",
					},
				},
				{
					id: "resetNether",
					label: {
						ar: "ريسيت النذر",
						en: "Reset the Nether",
					},
					confirm: BridgeConfirm.Strong,
					confirmText: {
						ar: "يُحذف النذر بالكامل، ويُفقد كل ما بنيته هناك نهائيًا. يتولد نذر جديد عندما يدخله أحد اللاعبين.",
						en: "The whole Nether is deleted and everything you built there is gone for good. A new one generates the next time someone enters it.",
					},
				},
				{
					id: "resetEnd",
					label: {
						ar: "ريسيت الإند",
						en: "Reset the End",
					},
					confirm: BridgeConfirm.Strong,
					confirmText: {
						ar: "يُحذف الإند بالكامل، ويُفقد كل ما بنيته هناك نهائيًا. يتولد إند جديد مع التنين عندما يدخله أحد اللاعبين.",
						en: "The whole End is deleted and everything you built there is gone for good. A new one generates, dragon included, the next time someone enters it.",
					},
				},
			],
			empty: {
				ar: "لا توجد مابات. تتولد ماب جديدة عند أول تشغيل لسيرفرك.",
				en: "No world found. The first time you start your server, one is generated for you.",
			},
		},
	],
};

const pluginsTab: Bridge.Tab = {
	id: "plugins",
	title: {
		ar: "الإضافات",
		en: "Plugins",
	},
	icon: BridgeIcon.Puzzle,
	sections: [
		{
			layout: BridgeLayout.Catalog,
			id: "plugin-list",
			module: "addons",
			empty: {
				ar: "لا توجد إضافات مثبّتة بعد.",
				en: "No plugins installed yet.",
			},
			visibleWhen: {
				variable: "SERVER_TYPE",
				values: [
					"paper",
					"purpur",
				],
			},
		},
	],
};

const modsTab: Bridge.Tab = {
	id: "mods",
	title: {
		ar: "المودات",
		en: "Mods",
	},
	icon: BridgeIcon.Puzzle,
	sections: [
		{
			layout: BridgeLayout.Catalog,
			id: "mod-list",
			module: "addons",
			empty: {
				ar: "لا توجد مودات مثبّتة بعد.",
				en: "No mods installed yet.",
			},
			visibleWhen: {
				variable: "SERVER_TYPE",
				values: [
					"fabric",
					"forge",
					"neoforge",
				],
			},
		},
	],
};

export const panel: Bridge.Panel = {
	tabs: [
		versionTab,
		modpacksTab,
		settingsTab,
		playersTab,
		gameplayTab,
		worldsTab,
		pluginsTab,
		modsTab,
	],
};
