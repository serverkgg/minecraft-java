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
import { CHAT_MESSAGE_LENGTH, WORLD_STAGING, XP_MAX_LEVELS, XP_MIN_LEVELS } from "../shared";

const LOADER_TYPES = [
	"paper",
	"purpur",
	"fabric",
	"forge",
	"neoforge",
];

const GAME_MODE_OPTIONS: Bridge.Option[] = [
	{
		value: "survival",
		label: {
			ar: "البقاء",
			en: "Survival",
		},
	},
	{
		value: "creative",
		label: {
			ar: "الإبداع",
			en: "Creative",
		},
	},
	{
		value: "adventure",
		label: {
			ar: "المغامرة",
			en: "Adventure",
		},
	},
	{
		value: "spectator",
		label: {
			ar: "المشاهدة",
			en: "Spectator",
		},
	},
];

const DIFFICULTY_OPTIONS: Bridge.Option[] = [
	{
		value: "peaceful",
		label: {
			ar: "مسالم",
			en: "Peaceful",
		},
	},
	{
		value: "easy",
		label: {
			ar: "سهل",
			en: "Easy",
		},
	},
	{
		value: "normal",
		label: {
			ar: "عادي",
			en: "Normal",
		},
	},
	{
		value: "hard",
		label: {
			ar: "صعب",
			en: "Hard",
		},
	},
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
		ar: "شيل المودباك يشيله هو وموداته والماب اللي بنيته عليه، ويرجّع سيرفرك عادي على نفس النوع والنسخة بماب جديدة. اللي ركّبته بنفسك يبقى.",
		en: "Removing the modpack takes it, its mods and the world you built on it, and leaves your server plain on the same type and version with a fresh world. Anything you installed yourself stays.",
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
				ar: "نركّب آخر إصدار من نفس المودباك. مابك تبقى إذا الإصدار الجديد على نفس النوع ونفس النسخة أو أحدث.",
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
		ar: "ما ركّبنا المودباك بعد. افتح تبويب المودباك وشوف وين وصل.",
		en: "The modpack is not installed yet. Open the Modpacks tab to see where it stands.",
	},
	visibleWhen: {
		variable: MODPACK_VARIABLE,
		empty: false,
	},
};

const versionTab: Bridge.Tab = {
	id: "version",
	title: {
		ar: "النسخة",
		en: "Version",
	},
	icon: BridgeIcon.Tag,
	sections: [
		modpackStatusSection,
		{
			layout: BridgeLayout.Form,
			id: "version",
			help: {
				ar: "غيّر نوع سيرفرك أو نسخته، ونركّبه لك من جديد على اللي تختاره.",
				en: "Change your server's type or version and we reinstall it on what you pick.",
			},
			target: BridgeFormTarget.Variables,
			module: "version",
			reinstall: true,
			confirm: BridgeConfirm.Strong,
			confirmText: {
				ar: "حسب التغيير، مابك إما تبقى مكانها، أو ننقل ملفاتها للمكان الجديد، أو يروح كل اللي أضافته المودات لها. والرجوع لنسخة أقدم يبدأ ماب جديدة دايمًا.",
				en: "Depending on the change your world may stay where it is, be moved into place, or lose what mods added to it. Going back to an older version always starts a fresh world.",
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
						ar: "غيّر النوع إذا تبي إضافات أو مودات.",
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
						ar: "نسخة ماينكرافت",
						en: "Minecraft version",
					},
					help: {
						ar: "اتركها فاضية عشان تبقى على نسختك الحالية (وآخر إصدار على سيرفر جديد)، واختر وحدة إذا تبي تغيّرها.",
						en: "Leave it empty to keep the version you are on (the latest release on a fresh server); pick one to change it.",
					},
					options: {
						module: "gameVersion",
					},
				},
				{
					key: "LOADER_VERSION",
					control: BridgeControl.Select,
					label: {
						ar: "نسخة المشغّل",
						en: "Loader build",
					},
					help: {
						ar: "اتركها فاضية عشان تبقى على المشغّل الحالي، أو اختَر إصدار محدد للتحديث.",
						en: "Leave empty to keep the installed loader, or select a specific build to update.",
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
						ar: "سيرفرك على مودباك. أي تغيير هنا يشيل المودباك وموداته والماب اللي بنيته عليه، ويرجّع سيرفرك على النوع والنسخة اللي تختارها بماب جديدة.",
						en: "Your server runs a modpack. Any change here removes the pack, its mods and the world you built on it, and puts your server on the type and version you pick with a fresh world.",
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
				ar: "تركيب المودباك يبني سيرفرك من جديد: يمسح مجلدات المودات والإعدادات كاملة، حتى المودات اللي ركّبتها بنفسك. مابك تبقى مكانها إلا إذا المودباك يبي نسخة أقدم من نسختك، وإذا كان سيرفرك على مود لودر وطلعت منه يروح كل اللي أضافته المودات لمابك. وشيل المودباك يشيله هو وموداته والماب اللي بنيته عليه، ويرجّع سيرفرك عادي بماب جديدة.",
				en: "Installing a modpack rebuilds your server: the mods and config folders are wiped, including mods you installed yourself. Your world stays unless the pack needs an older version than yours, and if you leave a mod loader everything the mods added to your world is lost. Removing the modpack takes it, its mods and the world you built on it, and leaves your server plain with a fresh world.",
			},
			empty: {
				ar: "ما ركّبت أي مودباك. دوّر على واحد فوق واختره، وإحنا نجهّز سيرفرك عليه.",
				en: "No modpack installed. Search for one above and pick it — we set your server up for it.",
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
				ar: "خل أصحابك من الجوال أو الكونسول أو ويندوز يدخلون سيرفرك.",
				en: "Let friends on phone, console or Windows into your server.",
			},
			target: BridgeFormTarget.Variables,
			reinstall: false,
			confirm: BridgeConfirm.Normal,
			confirmText: {
				ar: "حفظ التغيير يعيد تشغيل سيرفرك على طول عشان يشتغل التعديل.",
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
						ar: "نركّب Geyser و Floodgate ونحدّثهم لك. أول ما تفعّله يظهر عنوان بيدروك في صفحة سيرفرك، وأصحابك من الجوال أو الكونسول أو ويندوز يدخلون عليه، وأسماءهم داخل اللعبة تبدأ بنقطة.",
						en: "We install and update Geyser and Floodgate for you. The Bedrock address appears on your server page once crossplay is on, friends on phone, console or Windows join on it, and their in-game names start with a dot.",
					},
					warning: {
						ar: "كروس بلاي ياخذ رام زيادة. إذا سيرفرك 1GB بس، توقّع لاق.",
						en: "Crossplay needs extra memory. On a 1GB server expect lag.",
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
				ar: "توافق النسخ",
				en: "Version compatibility",
			},
			help: {
				ar: "خل أصحابك يدخلون سيرفرك بنسخة جافا غير نسخته.",
				en: "Let friends join your server on a Java version other than its own.",
			},
			target: BridgeFormTarget.Variables,
			reinstall: false,
			confirm: BridgeConfirm.Normal,
			confirmText: {
				ar: "حفظ التغيير يعيد تشغيل سيرفرك على طول عشان يشتغل التعديل.",
				en: "Saving restarts your server right away so the change takes effect.",
			},
			fields: [
				{
					key: "VERSION_COMPAT",
					control: BridgeControl.Boolean,
					label: {
						ar: "دخول نسخ جافا الثانية",
						en: "Let other Java versions in",
					},
					help: {
						ar: "نركّب ViaVersion و ViaBackwards ونحدّثهم لك. أصحابك يدخلون سيرفرك بنسخة جافا أحدث أو أقدم من نسخة سيرفرك، وما يغيّرون شي عندهم.",
						en: "We install and update ViaVersion and ViaBackwards for you. Friends join on a Java version newer or older than your server, with nothing to change on their side.",
					},
					warning: {
						ar: "البلوكات والأغراض اللي جت مع النسخ الجديدة تطلع ناقصة أو شكلها غلط عند اللي داخل بنسخة أقدم.",
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
				ar: "إعدادات اللعبة نفسها اللي تنكتب في ملف server.properties.",
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
						ar: "النص اللي يظهر للاعبين في قائمة السيرفرات.",
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
						ar: "نمط اللعب",
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
						ar: "لما تفعّلها، ما يدخل إلا اللاعبين اللي تضيفهم بنفسك.",
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
						ar: "كل ما زاد، زاد استهلاك المعالج والذاكرة.",
						en: "Higher values cost more CPU and memory.",
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
						ar: "بذرة العالم",
						en: "World seed",
					},
					help: {
						ar: "اتركها فاضية لعالم عشوائي. تغييرها ما يأثر على عالم موجود.",
						en: "Leave empty for a random world. Changing it does not affect an existing world.",
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
		ar: "اللاعبين",
		en: "Players",
	},
	icon: BridgeIcon.Users,
	sections: [
		{
			layout: BridgeLayout.Table,
			id: "players",
			title: {
				ar: "المتصلون الحين",
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
						ar: "طرد",
						en: "Kick",
					},
					confirm: BridgeConfirm.Normal,
				},
				{
					id: "ban",
					label: {
						ar: "حظر",
						en: "Ban",
					},
					confirm: BridgeConfirm.Normal,
					offline: true,
				},
				{
					id: "op",
					label: {
						ar: "ترقية لمشرف",
						en: "Make operator",
					},
					confirm: BridgeConfirm.Strong,
				},
				{
					id: "xp",
					label: {
						ar: "زيادة الخبرة",
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
						ar: "تغيير النمط",
						en: "Change game mode",
					},
					fields: [
						{
							key: "mode",
							control: BridgeControl.Select,
							label: {
								ar: "نمط اللعب",
								en: "Game mode",
							},
							options: GAME_MODE_OPTIONS,
						},
					],
				},
				{
					id: "kill",
					label: {
						ar: "قتل",
						en: "Kill",
					},
					confirm: BridgeConfirm.Normal,
					confirmText: {
						ar: "يموت اللاعب داخل اللعبة ويرجع لنقطة البداية، وأغراضه تنزل مكانه.",
						en: "The player dies in game and respawns, dropping whatever they carried.",
					},
				},
			],
			empty: {
				ar: "ما فيه أحد داخل السيرفر حاليًا.",
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
					ar: "إضافة لاعب",
					en: "Add player",
				},
				placeholder: "Steve  ·  .Gamer Tag",
			},
			actions: [
				{
					id: "remove",
					label: {
						ar: "إزالة",
						en: "Remove",
					},
					confirm: BridgeConfirm.Normal,
				},
			],
			empty: {
				ar: "القائمة البيضاء فاضية. اكتب اسم لاعب جافا زي ما هو، ولاعب بيدروك اكتب اسمه بنقطة قبله ومسافاته زي ما هي.",
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
						ar: "رفع الحظر",
						en: "Unban",
					},
					confirm: BridgeConfirm.Normal,
				},
			],
			empty: {
				ar: "ما فيه أحد محظور من سيرفرك. أي لاعب تحظره من جدول المتصلين يطلع لك هنا، ومن هنا ترفع عنه الحظر ويرجع يدخل على طول.",
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
			id: "diagnostics",
			layout: BridgeLayout.Detail,
			module: "diagnostics",
			actions: [
				{
					id: "profile",
					label: {
						ar: "افحص لمدة 60 ثانية",
						en: "Profile for 60 seconds",
					},
					confirm: BridgeConfirm.Normal,
					confirmText: {
						ar: "نجمع تقرير أداء لمدة 60 ثانية ونرفعه لموقع spark. اللي معه الرابط يقدر يشوف تفاصيل الأداء والإضافات.",
						en: "Collect 60 seconds of performance data and upload it to spark. Anyone with the link can view the performance and plugin details.",
					},
				},
				{
					id: "cancel",
					label: {
						ar: "إلغاء الفحص بدون رفع",
						en: "Cancel without uploading",
					},
				},
			],
			empty: {
				ar: "شغّل السيرفر عشان تفحص اللاق.",
				en: "Start the server to diagnose lag.",
			},
		},
		{
			layout: BridgeLayout.Actions,
			id: "world",
			title: {
				ar: "التحكم بالماب",
				en: "World controls",
			},
			help: {
				ar: "أوامر تشتغل على طول على سيرفرك الشغّال، وترجع لإعدادات السيرفر بعد إعادة التشغيل.",
				en: "These run on your server right away and fall back to its settings after a restart.",
			},
			module: "gameplay",
			actions: [
				{
					id: "timeDay",
					label: {
						ar: "خله نهار",
						en: "Set day",
					},
				},
				{
					id: "timeNight",
					label: {
						ar: "خله ليل",
						en: "Set night",
					},
				},
				{
					id: "weatherClear",
					label: {
						ar: "جو صافي",
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
								ar: "عشان تبقى بعد إعادة التشغيل، غيّرها من الإعدادات.",
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
				ar: "توصل لكل اللي داخلين السيرفر الحين.",
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
						ar: "نجهّز ماب جديدة ونفعّلها عند التشغيل. مابك الحالية تبقى محفوظة.",
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
						ar: "الشغّالة",
						en: "Active",
					},
				},
			],
			upload: {
				label: {
					ar: "رفع ماب",
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
						ar: "تجهيز التنزيل",
						en: "Prepare download",
					},
					confirm: BridgeConfirm.Normal,
					confirmText: {
						ar: "نجهّز ZIP فيه الماب والنذر والإند. بعدها اضغط تنزيل. وقّف سيرفرك قبل إذا تبي نسخة مضمونة.",
						en: "We prepare a ZIP with the world, Nether and End, then select Download. Stop the server first if you want a clean copy.",
					},
				},

				{
					id: "clone",
					label: {
						ar: "نسخ الماب",
						en: "Clone world",
					},
					confirm: BridgeConfirm.Normal,
					fields: [
						{
							key: "name",
							control: BridgeControl.Text,
							label: {
								ar: "اسم النسخة الجديدة",
								en: "New world name",
							},
							maxLength: 32,
						},
					],
				},
				{
					id: "download",
					label: {
						ar: "تنزيل",
						en: "Download",
					},
					download: true,
				},
				{
					id: "activate",
					label: {
						ar: "تفعيل",
						en: "Activate",
					},
					confirm: BridgeConfirm.Normal,
					confirmText: {
						ar: "نبدّل الماب في إعدادات السيرفر. إذا كان شغّال، الماب الجديدة ما تفتح إلا بعد ما تعيد تشغيله.",
						en: "We switch the world in the server settings. If it is running, the new world only opens after you restart it.",
					},
				},
				{
					id: "delete",
					label: {
						ar: "حذف",
						en: "Delete",
					},
					confirm: BridgeConfirm.Strong,
					confirmText: {
						ar: "حذف الماب يشيلها هي والنذر والإند حقها للأبد. النسخة الاحتياطية هي طريقك الوحيد للرجوع، فخذ لك وحدة قبل لا تكمّل.",
						en: "Deleting a world removes it with its Nether and its End forever. A backup is your only way back, so take one before you continue.",
					},
				},
				{
					id: "resetNether",
					label: {
						ar: "تصفير النذر",
						en: "Reset the Nether",
					},
					confirm: BridgeConfirm.Strong,
					confirmText: {
						ar: "نمسح النذر كامل، وكل اللي بنيته هناك يروح للأبد. يتولد نذر جديد أول ما أحد يدخله.",
						en: "The whole Nether is wiped and everything you built there is gone forever. A new one generates the next time somebody walks in.",
					},
				},
				{
					id: "resetEnd",
					label: {
						ar: "تصفير الإند",
						en: "Reset the End",
					},
					confirm: BridgeConfirm.Strong,
					confirmText: {
						ar: "نمسح الإند كامل، وكل اللي بنيته هناك يروح للأبد. يتولد إند جديد بتنينه أول ما أحد يدخله.",
						en: "The whole End is wiped and everything you built there is gone forever. A new one generates, dragon included, the next time somebody walks in.",
					},
				},
			],
			empty: {
				ar: "ما لقينا أي ماب. أول ما تشغّل سيرفرك يتولد لك ماب جديدة.",
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
				ar: "ما ركّبت أي إضافات بعد.",
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
				ar: "ما ركّبت أي مودات بعد.",
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
