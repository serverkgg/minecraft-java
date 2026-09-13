import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { safeWorldName, setActiveWorld, worldPaths } from "./world";

export const worldNameArgument = (value: unknown) => {
	if (typeof value !== "string" || value.length === 0 || safeWorldName(value) !== value) {
		throw new BridgeUserError({
			ar: "سمّ الماب بـ 1 إلى 32 حرف إنجليزي أو رقم، وتقدر تستخدم - أو _ بين الحروف.",
			en: "Use a world name of 1–32 Latin letters or digits, with - or _ between characters.",
		});
	}
	return value;
};

export const assertNewWorld = async (context: Bridge.Context, name: string) => {
	for (const path of worldPaths(name)) {
		if (await context.files.exists(path)) {
			throw new BridgeUserError({
				ar: "فيه ماب بنفس الاسم. اختَر اسم ثاني.",
				en: "A world already uses that name. Choose another name.",
			});
		}
	}
};

export const inspectJavaWorld = async (context: Bridge.Context, directory: string) => {
	if (await context.files.exists(`${directory}/db`)) {
		throw new BridgeUserError({
			ar: "هذي ماب بيدروك. ارفعها على سيرفر بيدروك؛ سيرفر جافا ما يفتحها.",
			en: "This is a Bedrock world. Import it on a native Bedrock server; Java cannot open it.",
		});
	}
	if ((await context.files.size(`${directory}/level.dat`)) > 16 * 1024 * 1024) {
		throw new BridgeUserError({
			ar: "ملف بيانات الماب أكبر من الحد المسموح. تأكد إنك رفعت الماب الصحيحة.",
			en: "The world metadata exceeds the size limit. Check the uploaded world.",
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
			ar: "ملف الماب ما يشبه ماب جافا سليمة. صدّر الماب من اللعبة وارفعها مرة ثانية.",
			en: "The world metadata is not a Java world file. Export the world from the game and upload it again.",
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
			ar: "ملف بيانات الماب تالف. صدّرها من اللعبة وارفعها مرة ثانية.",
			en: "The world metadata is corrupt. Export it from the game and upload it again.",
		});
	}
};

export const cloneWorld = async (context: Bridge.Context, source: string, name: string) => {
	worldNameArgument(source);
	worldNameArgument(name);
	await assertNewWorld(context, name);
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
				ar: "الماب فيها رابط ملفات. احذفه قبل نسخ الماب.",
				en: "The world contains a symbolic link. Remove it before cloning.",
			});
		}
	}

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
					ar: "ما قدرنا ننسخ الماب. تأكد من المساحة وجرّب مرة ثانية.",
					en: "Could not clone the world. Check disk space and retry.",
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

export const worldTools: Bridge.Actions = {
	kind: BridgeKind.Actions,
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
					ar: "السيد طويل أو فيه أحرف ما تنقبل. اكتب سيد أقصر من 65 حرف.",
					en: "Use a seed of at most 64 characters without line breaks.",
				});
			}
			await context.codec.properties.merge("server.properties", {
				"level-seed": seed,
			});
			await setActiveWorld(context, name);
			context.log("a new world will generate on the next start", {
				world: name,
			});
		},
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
			ar: "الماب فيها رابط ملفات ما نقدر نصدّره. احذف الرابط وجرّب مرة ثانية.",
			en: "The world contains a symbolic link and cannot be exported. Remove the link and retry.",
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
			ar: "ما قدرنا نصدّر الماب. تأكد من المساحة وجرّب مرة ثانية.",
			en: "Could not export the world. Check disk space and retry.",
		});
	}
	await context.files.move(pending, archive);
};
