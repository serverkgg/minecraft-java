import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { curseforgeDownloadUrl, curseforgeSha1 } from "@serverkgg/bridge/catalogs";
import { execDetail } from "@serverkgg/bridge/utils";
import { readSidecar, type SidecarEntry } from "../addons";
import { isCompanionFile } from "../companions";
import { readInstallStamp } from "../install";
import { MODPACK_VARIABLE, MODS_DIRECTORY, modPath, readModpackSidecar } from "../modpacks";
import { CatalogProviderId, curseforgeCatalog, modrinthVersionsByHashes } from "../providers";
import { STAGING_ROOT } from "../shared";
import { type ClientPackIdentity, clientPackVariant } from "./clientPackIdentity";
import { type ClientPackModrinthMod, clientPackIndex } from "./clientPackIndex";
import { CLIENT_PACK_MODLIST, type ClientPackCurseforgeMod, clientPackManifest } from "./clientPackManifest";

export enum ClientPackFormat {
	CurseForge = "curseforge",
	Modrinth = "modrinth",
}

export const CLIENT_PACK_ROW = "client-pack";

export const CLIENT_PACK_FILE = "client-pack";

export const CLIENT_PACK_DIRECTORY = ".serverk-exports/client-pack";

export const CLIENT_PACK_SIDECAR = ".serverk-client-pack.json";

export const CLIENT_PACK_STAGING = `${STAGING_ROOT}/client-pack`;

export const CLIENT_PACK_BUILD = `${CLIENT_PACK_STAGING}/pack`;

export const CLIENT_PACK_NAME_LIMIT = 64;

export const CLIENT_PACK_LISTED_FILES = 5;

export const CLIENT_PACK_ZIP_SCRIPT = 'cd "$1" && shift && exec zip -q -r "$@"';

const ZIP_TIMEOUT_MS = 60_000;

const OVERRIDES = "overrides";

const CURSEFORGE_MANIFEST = "manifest.json";

const MODRINTH_INDEX = "modrinth.index.json";

const MOD_JARS = `${MODS_DIRECTORY}/*.jar`;

const NUMERIC_ID = /^[0-9]+$/;

const FORMATS = new Set<string>(Object.values(ClientPackFormat));

const FORMAT_EXTENSIONS: Record<ClientPackFormat, string> = {
	[ClientPackFormat.CurseForge]: "zip",
	[ClientPackFormat.Modrinth]: "mrpack",
};

const FORMAT_ENTRIES: Record<ClientPackFormat, string[]> = {
	[ClientPackFormat.CurseForge]: [
		CURSEFORGE_MANIFEST,
		CLIENT_PACK_MODLIST,
		OVERRIDES,
	],
	[ClientPackFormat.Modrinth]: [
		MODRINTH_INDEX,
		OVERRIDES,
	],
};

const FORMAT_LABELS: Record<ClientPackFormat, string> = {
	[ClientPackFormat.CurseForge]: "CurseForge",
	[ClientPackFormat.Modrinth]: "Modrinth",
};

export const CLIENT_PACK_APPS: Record<ClientPackFormat, Bridge.Text> = {
	[ClientPackFormat.CurseForge]: {
		ar: "لانشر CurseForge",
		en: "CurseForge app",
	},
	[ClientPackFormat.Modrinth]: {
		ar: "لانشر Modrinth أو Prism",
		en: "Modrinth app or Prism",
	},
};

const MODPACK_APPLIED: Bridge.Text = {
	ar: "سيرفرك على مودباك، واللاعبون يحتاجون المودباك نفسه. تجد اسمه في تبويب الإصدار، فأرسله لهم ليثبّتوه في اللانشر.",
	en: "Your server runs a modpack, and players need that same modpack. Its name is in the Version tab, so send it to them to install in their launcher.",
};

const NOT_INSTALLED: Bridge.Text = {
	ar: "لم يكتمل تثبيت سيرفرك بعد. شغّله مرة، ثم جرب مرة ثانية.",
	en: "Your server isn't installed yet. Start it once, then try again.",
};

const NO_FETCHABLE_MODS: Bridge.Text = {
	ar: "لا توجد في مجلد mods مودات يستطيع اللانشر تنزيلها من Modrinth أو CurseForge، ولذلك لا يوجد ما نضعه في المودباك. ثبّت مودات من الكتالوج في الأعلى، ثم جرب مرة ثانية.",
	en: "The mods folder has no mods a launcher can download from Modrinth or CurseForge, so there's nothing to put in the pack. Install mods from the catalog above, then try again.",
};

const PACK_NAME_INVALID: Bridge.Text = {
	ar: `اكتب اسمًا للمودباك من 1 إلى ${CLIENT_PACK_NAME_LIMIT} حرفًا.`,
	en: `Type a pack name of 1 to ${CLIENT_PACK_NAME_LIMIT} characters.`,
};

const ZIP_FAILED: Bridge.Text = {
	ar: "تعذّر تجهيز ملف المودباك. تأكد من المساحة وجرب مرة ثانية.",
	en: "We couldn't build the pack file. Check disk space and try again.",
};

interface ClientPackRecord {
	name: string;
	format: ClientPackFormat;
	mods: number;
	builtAt: string;
}

interface PackJar {
	fileName: string;
	entry: SidecarEntry | null;
}

interface HashedJar extends PackJar {
	sha1: string;
	sha512: string;
	sizeBytes: number;
}

interface CurseforgeRef {
	projectId: number;
	fileId: number;
	title: string;
	pageUrl: string | null;
}

interface PackSource {
	identity: ClientPackIdentity;
	jars: PackJar[];
}

interface PackPlan {
	format: ClientPackFormat;
	curseforge: ClientPackCurseforgeMod[];
	modrinth: ClientPackModrinthMod[];
	count: number;
	left: string[];
}

let buildLock: Promise<unknown> = Promise.resolve();

const exclusive = <Result>(run: () => Promise<Result>): Promise<Result> => {
	const next = buildLock.then(run, run);

	buildLock = next.catch(() => undefined);

	return next;
};

export const parseClientPackRecord = (text: string): ClientPackRecord | null => {
	try {
		const parsed = JSON.parse(text) as Partial<ClientPackRecord>;

		if (typeof parsed.name !== "string" || typeof parsed.format !== "string" || !FORMATS.has(parsed.format)) {
			return null;
		}

		return {
			name: parsed.name,
			format: parsed.format,
			mods: typeof parsed.mods === "number" ? parsed.mods : 0,
			builtAt: typeof parsed.builtAt === "string" ? parsed.builtAt : "",
		};
	} catch {
		return null;
	}
};

const readClientPackRecord = async (context: Bridge.Context) => {
	if (!(await context.files.exists(CLIENT_PACK_SIDECAR))) {
		return null;
	}

	return parseClientPackRecord(await context.files.read(CLIENT_PACK_SIDECAR));
};

export const clientPackName = (input: string) => {
	const name = input.trim();

	if (name.length === 0 || name.length > CLIENT_PACK_NAME_LIMIT) {
		throw new BridgeUserError(PACK_NAME_INVALID);
	}

	return name;
};

export const modCountText = (count: number): Bridge.Text => {
	const tens = count % 100;
	const en = count === 1 ? "1 mod" : `${count} mods`;

	if (count === 1) {
		return {
			ar: "مودًا واحدًا",
			en,
		};
	}

	if (count === 2) {
		return {
			ar: "مودين",
			en,
		};
	}

	if (tens >= 3 && tens <= 10) {
		return {
			ar: `${count} مودات`,
			en,
		};
	}

	return {
		ar: tens >= 11 ? `${count} مودًا` : `${count} مود`,
		en,
	};
};

const listedNames = (names: string[]): Bridge.Text => {
	const shown = names.slice(0, CLIENT_PACK_LISTED_FILES);

	if (names.length <= CLIENT_PACK_LISTED_FILES) {
		return {
			ar: shown.join("، "),
			en: shown.join(", "),
		};
	}

	return {
		ar: `${shown.join("، ")} وغيرها (${names.length})`,
		en: `${shown.join(", ")} and more (${names.length})`,
	};
};

const leftText = (left: string[]): Bridge.Text => {
	const names = listedNames(left);

	if (left.length === 1) {
		return {
			ar: `الملف ${names.ar} ليس في المودباك لأن اللانشر لا يستطيع تنزيله من Modrinth أو CurseForge، فأرسله للاعبين بنفسك.`,
			en: `${names.en} isn't in the pack because a launcher can't download it from Modrinth or CurseForge, so send it to players yourself.`,
		};
	}

	return {
		ar: `الملفات ${names.ar} ليست في المودباك لأن اللانشر لا يستطيع تنزيلها من Modrinth أو CurseForge، فأرسلها للاعبين بنفسك.`,
		en: `${names.en} aren't in the pack because a launcher can't download them from Modrinth or CurseForge, so send them to players yourself.`,
	};
};

export const clientPackNotice = (format: ClientPackFormat, count: number, left: string[]): Bridge.Text => {
	const mods = modCountText(count);
	const app = CLIENT_PACK_APPS[format];
	const label = FORMAT_LABELS[format];
	const built = {
		ar: `تم تجهيز مودباك ${label} يضم ${mods.ar}. نزّله وأرسله للاعبين ليستوردوه في ${app.ar}.`,
		en: `Built a ${label} pack with ${mods.en}. Download it and send it to players to import in the ${app.en}.`,
	};

	if (left.length === 0) {
		return built;
	}

	const missing = leftText(left);

	return {
		ar: `${built.ar} ${missing.ar}`,
		en: `${built.en} ${missing.en}`,
	};
};

const optedOut = (title: string): Bridge.Text => {
	return {
		ar: `صاحب مود ${title} لا يسمح بتنزيله إلا من CurseForge، ولذلك لا يمكن وضعه في مودباك Modrinth. احذفه أو استبدله بمود من Modrinth، ثم جرب مرة ثانية.`,
		en: `The author of ${title} allows downloads only from CurseForge, so it can't go in a Modrinth pack. Remove it or replace it with a mod from Modrinth, then try again.`,
	};
};

const unmatched = (title: string): Bridge.Text => {
	return {
		ar: `تعذّرت مطابقة ملف ${title} في مجلد mods مع نسخته في الكتالوج، ولذلك لن يقبله لانشر اللاعب. ثبّته من الكتالوج من جديد، ثم جرب مرة ثانية.`,
		en: `We couldn't match the ${title} file in the mods folder with its copy in the catalog, so players' launchers would reject it. Install it again from the catalog, then try again.`,
	};
};

const modpackApplied = async (context: Bridge.Context) => {
	return (context.variable(MODPACK_VARIABLE) ?? "").length > 0 || (await readModpackSidecar(context)) !== null;
};

const curseforgeRef = (entry: SidecarEntry | null): CurseforgeRef | null => {
	const fileId = entry?.versionId ?? "";

	if (entry?.provider !== CatalogProviderId.CurseForge || !NUMERIC_ID.test(entry.project) || !NUMERIC_ID.test(fileId)) {
		return null;
	}

	return {
		projectId: Number(entry.project),
		fileId: Number(fileId),
		title: entry.title,
		pageUrl: entry.pageUrl,
	};
};

export const clientPackFormat = (entries: (SidecarEntry | null)[]) => {
	return entries.every((entry) => curseforgeRef(entry) !== null)
		? ClientPackFormat.CurseForge
		: ClientPackFormat.Modrinth;
};

const packSource = async (context: Bridge.Context, name: string, version: string): Promise<PackSource> => {
	if (await modpackApplied(context)) {
		throw new BridgeUserError(MODPACK_APPLIED);
	}

	const stamp = await readInstallStamp(context);

	if (!stamp) {
		throw new BridgeUserError(NOT_INSTALLED);
	}

	const identity: ClientPackIdentity = {
		name,
		version,
		mcVersion: stamp.version,
		variant: stamp.variant,
		loaderVersion: stamp.build ?? "",
	};

	clientPackVariant(identity);

	const sidecar = await readSidecar(context, MODS_DIRECTORY);
	const jars = (await context.files.list(MOD_JARS))
		.map((entry) => entry.name)
		.filter((fileName) => !isCompanionFile(context, fileName))
		.sort()
		.map((fileName) => {
			return {
				fileName,
				entry: sidecar[fileName] ?? null,
			};
		});

	if (jars.length === 0) {
		throw new BridgeUserError(NO_FETCHABLE_MODS);
	}

	return {
		identity,
		jars,
	};
};

const curseforgeMod = (jar: PackJar): ClientPackCurseforgeMod => {
	const ref = curseforgeRef(jar.entry);

	if (!ref) {
		throw new Error("a curseforge pack holds only curseforge mods with a file id");
	}

	return {
		fileName: jar.fileName,
		title: ref.title,
		projectId: ref.projectId,
		fileId: ref.fileId,
		pageUrl: ref.pageUrl,
	};
};

const curseforgePlan = (jars: PackJar[], left: string[]): PackPlan => {
	return {
		format: ClientPackFormat.CurseForge,
		curseforge: jars.map(curseforgeMod),
		modrinth: [],
		count: jars.length,
		left,
	};
};

const hashJar = async (context: Bridge.Context, jar: PackJar): Promise<HashedJar> => {
	const path = modPath(jar.fileName);

	return {
		...jar,
		sha1: await context.files.digest(path, "sha1"),
		sha512: await context.files.digest(path, "sha512"),
		sizeBytes: await context.files.size(path),
	};
};

const modrinthUrls = async (context: Bridge.Context, jars: HashedJar[]) => {
	const matches = await modrinthVersionsByHashes(
		context,
		jars.map((jar) => jar.sha1),
	);
	const urls = new Map<string, string>();

	for (const jar of jars) {
		const file = matches[jar.sha1]?.files.find((candidate) => candidate.hashes.sha1?.toLowerCase() === jar.sha1);

		if (file) {
			urls.set(jar.fileName, file.url);
		}
	}

	return urls;
};

const curseforgeUrls = async (context: Bridge.Context, jars: HashedJar[]) => {
	const refs = jars.flatMap((jar) => {
		const ref = curseforgeRef(jar.entry);

		return ref
			? [
					{
						jar,
						ref,
					},
				]
			: [];
	});

	const files = refs.length === 0 ? [] : await curseforgeCatalog(context).files(refs.map(({ ref }) => ref.fileId));
	const urls = new Map<string, string>();

	for (const { jar, ref } of refs) {
		const file = files.find((candidate) => candidate.id === ref.fileId);

		if (!file) {
			throw new BridgeUserError(unmatched(ref.title));
		}

		const url = curseforgeDownloadUrl(file);

		if (url === null) {
			throw new BridgeUserError(optedOut(ref.title));
		}

		const sha1 = curseforgeSha1(file);

		if (sha1 !== null && sha1 !== jar.sha1) {
			throw new BridgeUserError(unmatched(ref.title));
		}

		urls.set(jar.fileName, url);
	}

	return urls;
};

const planPack = async (context: Bridge.Context, jars: PackJar[]): Promise<PackPlan> => {
	if (clientPackFormat(jars.map((jar) => jar.entry)) === ClientPackFormat.CurseForge) {
		return curseforgePlan(jars, []);
	}

	const hashed: HashedJar[] = [];

	for (const jar of jars) {
		hashed.push(await hashJar(context, jar));
	}

	const found = await modrinthUrls(context, hashed);
	const included = hashed.filter((jar) => found.has(jar.fileName) || curseforgeRef(jar.entry) !== null);
	const left = hashed.filter((jar) => !included.includes(jar)).map((jar) => jar.fileName);

	if (included.length === 0) {
		throw new BridgeUserError(NO_FETCHABLE_MODS);
	}

	if (clientPackFormat(included.map((jar) => jar.entry)) === ClientPackFormat.CurseForge) {
		return curseforgePlan(included, left);
	}

	const urls = new Map([
		...found,
		...(await curseforgeUrls(
			context,
			included.filter((jar) => !found.has(jar.fileName)),
		)),
	]);

	return {
		format: ClientPackFormat.Modrinth,
		curseforge: [],
		modrinth: included.map((jar) => {
			const url = urls.get(jar.fileName);

			if (url === undefined) {
				throw new Error("every mod in a modrinth pack needs a download address");
			}

			return {
				fileName: jar.fileName,
				sha1: jar.sha1,
				sha512: jar.sha512,
				sizeBytes: jar.sizeBytes,
				url,
			};
		}),
		count: included.length,
		left,
	};
};

const writePackFiles = async (context: Bridge.Context, identity: ClientPackIdentity, plan: PackPlan) => {
	if (plan.format === ClientPackFormat.CurseForge) {
		const { manifest, modlist } = clientPackManifest(identity, plan.curseforge);

		await context.files.write(`${CLIENT_PACK_BUILD}/${CURSEFORGE_MANIFEST}`, manifest);
		await context.files.write(`${CLIENT_PACK_BUILD}/${CLIENT_PACK_MODLIST}`, modlist);

		return;
	}

	await context.files.write(`${CLIENT_PACK_BUILD}/${MODRINTH_INDEX}`, clientPackIndex(identity, plan.modrinth));
};

const packFileName = (format: ClientPackFormat) => {
	return `${CLIENT_PACK_FILE}.${FORMAT_EXTENSIONS[format]}`;
};

const zipPack = async (context: Bridge.Context, format: ClientPackFormat) => {
	const result = await context.exec(
		[
			"sh",
			"-c",
			CLIENT_PACK_ZIP_SCRIPT,
			"client-pack",
			CLIENT_PACK_BUILD,
			`../${packFileName(format)}`,
			...FORMAT_ENTRIES[format],
		],
		{
			timeoutMs: ZIP_TIMEOUT_MS,
		},
	);

	if (result.code !== 0) {
		context.log.warn("could not zip the client pack", {
			detail: execDetail(result),
		});

		throw new BridgeUserError(ZIP_FAILED);
	}
};

const packVersion = (builtAt: string) => {
	return `${builtAt.slice(0, 16)}Z`;
};

export const clientPackPath = (format: ClientPackFormat) => {
	return `${CLIENT_PACK_DIRECTORY}/${packFileName(format)}`;
};

const buildClientPack = async (context: Bridge.Context, input: string): Promise<Bridge.AddOutcome> => {
	const builtAt = new Date().toISOString();
	const source = await packSource(context, clientPackName(input), packVersion(builtAt));
	const plan = await planPack(context, source.jars);
	const pending = `${CLIENT_PACK_STAGING}/${packFileName(plan.format)}`;

	await context.files.remove(CLIENT_PACK_STAGING);
	await context.files.ensure(`${CLIENT_PACK_BUILD}/${OVERRIDES}`);

	try {
		await writePackFiles(context, source.identity, plan);
		await zipPack(context, plan.format);
		await context.files.remove(CLIENT_PACK_DIRECTORY);
		await context.files.ensure(CLIENT_PACK_DIRECTORY);
		await context.files.move(pending, clientPackPath(plan.format));
	} finally {
		await context.files.remove(CLIENT_PACK_STAGING);
	}

	const record: ClientPackRecord = {
		name: source.identity.name,
		format: plan.format,
		mods: plan.count,
		builtAt,
	};

	await context.files.write(CLIENT_PACK_SIDECAR, `${JSON.stringify(record, null, 2)}\n`);

	context.log("built a client pack", {
		format: plan.format,
		mods: plan.count,
		left: plan.left.length,
	});

	return {
		notice: clientPackNotice(plan.format, plan.count, plan.left),
	};
};

const packable = async (context: Bridge.Context) => {
	try {
		await packSource(context, "", "");

		return true;
	} catch (error) {
		if (error instanceof BridgeUserError) {
			return false;
		}

		throw error;
	}
};

export const clientPack: Bridge.Collection = {
	kind: BridgeKind.Collection,

	async list(context) {
		const record = await readClientPackRecord(context);

		if (!record || !(await context.files.exists(clientPackPath(record.format))) || !(await packable(context))) {
			return [];
		}

		return [
			{
				id: CLIENT_PACK_ROW,
				name: record.name,
				app: CLIENT_PACK_APPS[record.format],
				mods: record.mods,
				built: record.builtAt.slice(0, 10),
				path: clientPackPath(record.format),
			},
		];
	},

	async add(context, input) {
		return await exclusive(() => buildClientPack(context, input));
	},

	actions: {
		async remove(context) {
			await exclusive(async () => {
				await context.files.remove(CLIENT_PACK_DIRECTORY);
				await context.files.remove(CLIENT_PACK_SIDECAR);
			});

			context.log("removed the client pack");
		},
	},
};
