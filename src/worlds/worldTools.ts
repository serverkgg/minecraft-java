import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { readWorldSeed } from "./levelDat";
import {
	activeWorld,
	archiveWorld,
	discoverWorlds,
	freeWorldName,
	planWorldReset,
	safeWorldName,
	setActiveWorld,
	setLevelSeed,
	stagedWorldName,
	worldPaths,
} from "./world";

const UNGENERATED_WORLD: Bridge.Text = {
	ar: "لم يتولد الماب المفعّل بعد، لذلك لا يوجد ما ننفّذ له ريسيت. شغّل سيرفرك ليتولد الماب.",
	en: "The active world hasn't been generated yet, so there's nothing to reset. Start your server to generate it.",
};

const UNREADABLE_SEED: Bridge.Text = {
	ar: "تعذّرت قراءة سيد الماب من ملفاته، لذلك لم ننفّذ الريسيت. اكتب seed في الكونسول لمعرفة السيد، ثم أنشئ به مابًا جديدًا من «ماب جديد».",
	en: "We couldn't read the world's seed from its files, so the world wasn't reset. Type seed in the console to see it, then use it in Create world.",
};

const UNLISTED_SOURCE: Bridge.Text = {
	ar: "لا يوجد ماب بهذا الاسم في قائمة المابات. اكتب الاسم كما يظهر في القائمة.",
	en: "No world with that name is in the Worlds list. Type the name exactly as the list shows it.",
};

const ACTIVE_SOURCE: Bridge.Text = {
	ar: "هذا هو الماب المفعّل نفسه. اكتب اسم النسخة التي تريد الريسيت منها كما يظهر في قائمة المابات.",
	en: "That's the active world itself. Type the name of the copy you want to reset from, as the Worlds list shows it.",
};

const ONLY_WORLD: Bridge.Text = {
	ar: "الماب المفعّل هو الماب الوحيد في القائمة، لذلك لا توجد نسخة للريسيت منها. انسخ الماب أولًا من «انسخ الماب».",
	en: "The active world is the only one in the list, so there's no copy to reset from. Copy the world first with Copy world.",
};

const UNCOPIED_SOURCE: Bridge.Text = {
	ar: "تعذّر نسخ الماب، لذلك لم ننفّذ الريسيت وبقي الماب المفعّل كما هو. تأكد من المساحة وجرب مرة ثانية.",
	en: "We couldn't copy the world, so the active world wasn't reset. Check disk space and try again.",
};

const generatedActiveWorld = async (context: Bridge.Context) => {
	const world = await activeWorld(context);

	return (await discoverWorlds(context)).includes(world) ? world : null;
};

export const worldNameArgument = (value: unknown) => {
	if (typeof value !== "string" || value.length === 0 || safeWorldName(value) !== value) {
		throw new BridgeUserError({
			ar: "اسم الماب من 1 إلى 32 حرفًا إنجليزيًا أو رقمًا، ويمكن استخدام - أو _ بين الحروف.",
			en: "Use a world name of 1 to 32 Latin letters or digits, with - or _ between characters.",
		});
	}
	return value;
};

export const assertNewWorld = async (context: Bridge.Context, name: string) => {
	for (const path of worldPaths(name)) {
		if (await context.files.exists(path)) {
			throw new BridgeUserError({
				ar: "يوجد ماب بالاسم نفسه. اختر اسمًا آخر.",
				en: "A world already uses that name. Choose another name.",
			});
		}
	}
};

export const inspectJavaWorld = async (context: Bridge.Context, directory: string) => {
	if (await context.files.exists(`${directory}/db`)) {
		throw new BridgeUserError({
			ar: "هذا ماب بيدروك، ولا يستطيع سيرفر جافا فتحه. ارفعه على سيرفر بيدروك.",
			en: "This is a Bedrock world, and Java can't open it. Upload it to a Bedrock server.",
		});
	}
	if ((await context.files.size(`${directory}/level.dat`)) > 16 * 1024 * 1024) {
		throw new BridgeUserError({
			ar: "ملف بيانات الماب أكبر من الحد المسموح. تأكد من أنك رفعت الماب الصحيح.",
			en: "The world data file is over the size limit. Check that you uploaded the right world.",
		});
	}

	const header = await context.exec([
		"od",
		"-An",
		"-t",
		"x1",
		"-N",
		"3",
		"--",
		`${directory}/level.dat`,
	]);
	const bytes = header.stdout.trim().split(/\s+/);
	if (header.code !== 0 || bytes[0] !== "1f" || bytes[1] !== "8b" || bytes[2] !== "08") {
		throw new BridgeUserError({
			ar: "ملف الماب لا يبدو ماب جافا سليمًا. صدّر الماب من اللعبة وارفعه مرة ثانية.",
			en: "The world file doesn't look like a valid Java world. Export the world from the game and upload it again.",
		});
	}
	const valid = await context.exec(
		[
			"gzip",
			"-t",
			"--",
			`${directory}/level.dat`,
		],
		{
			timeoutMs: 10_000,
		},
	);
	if (valid.code !== 0) {
		throw new BridgeUserError({
			ar: "ملف بيانات الماب تالف. صدّره من اللعبة وارفعه مرة ثانية.",
			en: "The world data file is corrupt. Export it from the game and upload it again.",
		});
	}
};

const assertCopyableWorld = async (context: Bridge.Context, source: string) => {
	await inspectJavaWorld(context, source);
	for (const path of worldPaths(source)) {
		if (!(await context.files.exists(path))) {
			continue;
		}
		const links = await context.exec([
			"find",
			path,
			"-type",
			"l",
			"-print",
			"-quit",
		]);
		if (links.code !== 0 || links.stdout.trim().length > 0) {
			throw new BridgeUserError({
				ar: "يحتوي الماب على رابط ملفات. احذفه قبل نسخ الماب.",
				en: "The world contains a symbolic link. Delete it before copying the world.",
			});
		}
	}
};

const copyWorld = async (context: Bridge.Context, source: string, name: string) => {
	const copied: string[] = [];
	try {
		for (const [index, path] of worldPaths(source).entries()) {
			if (!(await context.files.exists(path))) {
				continue;
			}
			const target = worldPaths(name)[index];
			if (!target) {
				continue;
			}
			copied.push(target);
			const result = await context.exec(
				[
					"cp",
					"-R",
					"--no-dereference",
					"--",
					path,
					target,
				],
				{
					timeoutMs: 300_000,
				},
			);
			if (result.code !== 0) {
				throw new BridgeUserError({
					ar: "تعذّر نسخ الماب. تأكد من المساحة وجرب مرة ثانية.",
					en: "We couldn't copy the world. Check disk space and try again.",
				});
			}
			await context.files.remove(`${target}/uid.dat`);
			await context.files.remove(`${target}/session.lock`);
		}
	} catch (error) {
		for (const path of copied) {
			await context.files.remove(path);
		}
		throw error;
	}
};

export const cloneWorld = async (context: Bridge.Context, source: string, name: string) => {
	worldNameArgument(source);
	worldNameArgument(name);
	await assertNewWorld(context, name);
	await assertCopyableWorld(context, source);
	await copyWorld(context, source, name);
};

export const worldTools: Bridge.Actions = {
	kind: BridgeKind.Actions,
	protectedActions: [
		"resetWorld",
		"resetFromCopy",
	],
	actions: {
		async create(context, args) {
			const name = worldNameArgument(args.name);
			await assertNewWorld(context, name);
			const seed = typeof args.seed === "string" ? args.seed.trim() : "";
			if (
				seed.length > 64
				|| [
					...seed,
				].some((character) => character.charCodeAt(0) < 32)
			) {
				throw new BridgeUserError({
					ar: "السيد طويل أو يحتوي على أحرف غير مقبولة. اكتب سيدًا من 64 حرفًا أو أقل.",
					en: "The seed is too long or has characters we can't accept. Use a seed of at most 64 characters without line breaks.",
				});
			}
			await setLevelSeed(context, seed);
			await setActiveWorld(context, name);
			context.log("a new world will generate on the next start", {
				world: name,
			});
			context.activity.report({
				name: BridgeEventName.WorldCreated,
				text: {
					ar: `تم إنشاء ماب جديد ${name}، ويتولد عند التشغيل التالي`,
					en: `Created world ${name}, generated on the next start`,
				},
				subject: name,
				details: {
					world: name,
					...(seed.length > 0
						? {
								seed,
							}
						: {}),
				},
			});
		},

		async resetWorld(context) {
			const world = await generatedActiveWorld(context);

			if (world === null) {
				throw new BridgeUserError(UNGENERATED_WORLD);
			}

			const seed = await readWorldSeed(context, world);

			if (seed === null) {
				throw new BridgeUserError(UNREADABLE_SEED);
			}

			const archive = await planWorldReset(context);

			await archiveWorld(context, archive);
			await setLevelSeed(context, seed);

			context.log("reset a world", {
				world,
				archive: archive.to,
				seed,
			});

			context.activity.report({
				name: BridgeEventName.WorldWiped,
				text: {
					ar: `تم ريسيت ماب ${world}، والماب القديم محفوظ باسم ${archive.to}`,
					en: `Reset world ${world}, keeping the old one as ${archive.to}`,
				},
				subject: world,
				details: {
					world,
					scope: "world",
				},
			});
		},

		async resetFromCopy(context, args) {
			const world = await activeWorld(context);
			const listed = await discoverWorlds(context);

			if (!listed.includes(world)) {
				throw new BridgeUserError(UNGENERATED_WORLD);
			}

			const source = worldNameArgument(typeof args.source === "string" ? args.source.trim() : args.source);

			if (!listed.includes(source)) {
				throw new BridgeUserError(UNLISTED_SOURCE);
			}

			if (source === world) {
				throw new BridgeUserError(ACTIVE_SOURCE);
			}

			await assertCopyableWorld(context, source);

			const archive = await planWorldReset(context);
			const staging = await freeWorldName(context, stagedWorldName(world));

			try {
				await copyWorld(context, source, staging);
			} catch (error) {
				for (const path of worldPaths(staging)) {
					await context.files.remove(path);
				}
				throw new BridgeUserError(UNCOPIED_SOURCE, {
					cause: error,
				});
			}

			await archiveWorld(context, archive);

			const destinations = worldPaths(world);

			for (const [index, path] of worldPaths(staging).entries()) {
				const destination = destinations[index];

				if (destination && (await context.files.exists(path))) {
					await context.files.move(path, destination);
				}
			}

			context.log("reset a world from a copy", {
				world,
				from: source,
				archive: archive.to,
			});

			context.activity.report({
				name: BridgeEventName.WorldWiped,
				text: {
					ar: `تم ريسيت ماب ${world} من نسخة ${source}، والماب القديم محفوظ باسم ${archive.to}`,
					en: `Reset world ${world} from the copy ${source}, keeping the old one as ${archive.to}`,
				},
				subject: world,
				details: {
					world,
					scope: "copy",
					source,
				},
			});
		},
	},

	async unavailable(context): Promise<Bridge.Unavailable> {
		const world = await activeWorld(context);
		const listed = await discoverWorlds(context);

		if (!listed.includes(world)) {
			return {
				resetWorld: UNGENERATED_WORLD,
				resetFromCopy: UNGENERATED_WORLD,
			};
		}

		if (listed.length === 1) {
			return {
				resetFromCopy: ONLY_WORLD,
			};
		}

		return {};
	},
};

export const exportWorld = async (context: Bridge.Context, name: string) => {
	worldNameArgument(name);
	await inspectJavaWorld(context, name);
	await context.files.ensure(".serverk-exports");
	const archive = `.serverk-exports/${name}.zip`;
	const pending = `.serverk-exports/${name}.pending.zip`;
	await context.files.remove(pending);
	const paths: string[] = [];
	for (const path of worldPaths(name)) {
		if (await context.files.exists(path)) {
			paths.push(path);
		}
	}
	const links = await context.exec([
		"find",
		...paths,
		"-type",
		"l",
		"-print",
		"-quit",
	]);
	if (links.code !== 0 || links.stdout.trim().length > 0) {
		throw new BridgeUserError({
			ar: "يحتوي الماب على رابط ملفات لا يمكن تصديره. احذف الرابط وجرب مرة ثانية.",
			en: "The world contains a symbolic link that can't be exported. Delete the link and try again.",
		});
	}
	const result = await context.exec(
		[
			"zip",
			"-q",
			"-r",
			pending,
			...paths,
		],
		{
			timeoutMs: 300_000,
		},
	);
	if (result.code !== 0) {
		await context.files.remove(pending);
		throw new BridgeUserError({
			ar: "تعذّر تصدير الماب. تأكد من المساحة وجرب مرة ثانية.",
			en: "We couldn't export the world. Check disk space and try again.",
		});
	}
	await context.files.move(pending, archive);
};
