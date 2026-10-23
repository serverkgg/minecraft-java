import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { CatalogProviderId, newestPacksFirst } from "../providers";
import {
	fileNameOf,
	formatByteSize,
	isUnder,
	MODPACK_UPLOAD_STAGING,
	modpackIdentity,
	PACKS_DIRECTORY,
	type PackEntry,
	PackFormat,
	packArchivePath,
	packFormatOf,
	readPackIndex,
	relativeUploadPath,
	STAGING_ROOT,
	VARIANT_LABELS,
	writePackIndex,
} from "../shared";
import { MODPACK_VARIABLE } from "./applyModpack";
import { MODPACK_INDEX, parseModpackIndex } from "./modpackIndex";
import { MODPACK_MANIFEST, parseCurseforgeManifest } from "./modpackManifest";
import { decodeModpackRef } from "./modpackRef";
import { readModpackSidecar } from "./modpackSidecar";

export const MANIFEST_STAGING = `${STAGING_ROOT}/pack-upload`;

const SHA1_ALGORITHM = "sha1";

const APPLIED_MARK = "✓";

const PACK_NAME_LIMIT = 64;

const PACK_VERSION_LIMIT = 32;

const SHORT_SHA1_LENGTH = 8;

const DATE_LENGTH = 10;

const EXTENSION_PATTERN = /\.[^.]+$/;

const DECLARATIONS: Record<PackFormat, string> = {
	[PackFormat.CurseForge]: MODPACK_MANIFEST,
	[PackFormat.Modrinth]: MODPACK_INDEX,
};

const UPLOAD_NOT_FOUND: Bridge.Text = {
	ar: "تعذّر العثور على الملف المرفوع. ارفعه مرة ثانية.",
	en: "We couldn't find the uploaded file. Upload it again.",
};

const UNKNOWN_FORMAT: Bridge.Text = {
	ar: "هذا الملف ليس مودباكًا نقرؤه. ارفع ملف ZIP صدّرته من لانشر CurseForge أو ملف mrpack.",
	en: "This file isn't a modpack we can read. Upload a ZIP exported from the CurseForge app or an .mrpack file.",
};

const UNREADABLE_ARCHIVE: Bridge.Text = {
	ar: "تعذّر فتح الملف المرفوع كملف مضغوط. صدّر المودباك مرة ثانية وارفعه.",
	en: "We couldn't open the uploaded file as an archive. Export the modpack again and upload it.",
};

const DECLARATION_MISSING: Record<PackFormat, Bridge.Text> = {
	[PackFormat.CurseForge]: {
		ar: `لا يحتوي الملف المرفوع على ${MODPACK_MANIFEST}. صدّر المودباك من لانشر CurseForge، وارفع ملف ZIP الناتج كما هو.`,
		en: `The uploaded file has no ${MODPACK_MANIFEST}. Export the modpack from the CurseForge app and upload the ZIP it makes as it is.`,
	},
	[PackFormat.Modrinth]: {
		ar: `لا يحتوي الملف المرفوع على ${MODPACK_INDEX}. ارفع ملف mrpack الخاص بالمودباك كما هو.`,
		en: `The uploaded file has no ${MODPACK_INDEX}. Upload the modpack's .mrpack file as it is.`,
	},
};

const PACK_MISSING: Bridge.Text = {
	ar: "تعذّر العثور على هذا المودباك. حدّث القائمة وجرب مرة ثانية.",
	en: "We couldn't find that modpack. Refresh the list and try again.",
};

export const PACK_APPLIED: Bridge.Text = {
	ar: "سيرفرك على هذا المودباك. أزله من تبويب الإصدار أولًا، ثم احذفه من هنا.",
	en: "Your server runs this modpack. Remove it from the Version tab first, then delete it here.",
};

interface PackDeclaration {
	name: string;
	version: string;
	mcVersion: string;
	variant: PackEntry["variant"];
	loaderVersion: string;
	fileCount: number;
}

const loaderLabelOf = (entry: PackEntry) => {
	const loader = VARIANT_LABELS[entry.variant];

	return entry.loaderVersion.length > 0 ? `${loader} ${entry.loaderVersion}` : loader;
};

export const appliedPacks = async (context: Bridge.Context) => {
	const applied = new Set<string>();
	const declared = decodeModpackRef(context.variable(MODPACK_VARIABLE) ?? "");
	const sidecar = await readModpackSidecar(context);

	if (declared?.provider === CatalogProviderId.Upload) {
		applied.add(declared.project);
	}

	if (sidecar?.provider === CatalogProviderId.Upload) {
		applied.add(sidecar.project);
	}

	return applied;
};

const declaredVersionOf = (raw: string, format: PackFormat) => {
	try {
		const parsed = JSON.parse(raw) as {
			version?: unknown;
			versionId?: unknown;
		};

		const value = format === PackFormat.CurseForge ? parsed.version : parsed.versionId;

		return typeof value === "string" ? value.trim() : "";
	} catch {
		return "";
	}
};

const extractDeclaration = async (context: Bridge.Context, source: string, declaration: string) => {
	try {
		return await context.files.extract(source, MANIFEST_STAGING, {
			tree: true,
			selects: [
				declaration,
			],
		});
	} catch (error) {
		context.log.warn("could not open the uploaded modpack", {
			file: fileNameOf(source),
			error: error instanceof Error ? error.message : String(error),
		});

		throw new BridgeUserError(UNREADABLE_ARCHIVE, {
			cause: error,
		});
	}
};

export const readPackDeclaration = async (
	context: Bridge.Context,
	source: string,
	format: PackFormat,
): Promise<PackDeclaration> => {
	const declaration = DECLARATIONS[format];

	await context.files.remove(MANIFEST_STAGING);

	const written = await extractDeclaration(context, source, declaration);

	if (written.length === 0) {
		throw new BridgeUserError(DECLARATION_MISSING[format]);
	}

	const raw = await context.files.read(`${MANIFEST_STAGING}/${declaration}`);
	const version = declaredVersionOf(raw, format);

	if (format === PackFormat.CurseForge) {
		const manifest = parseCurseforgeManifest(raw);

		return {
			name: manifest.name,
			version,
			mcVersion: manifest.mcVersion,
			variant: manifest.variant,
			loaderVersion: manifest.loaderVersion,
			fileCount: manifest.files.length,
		};
	}

	const index = parseModpackIndex(raw);

	return {
		name: index.name,
		version,
		mcVersion: index.mcVersion,
		variant: index.variant,
		loaderVersion: index.loaderVersion,
		fileCount: index.files.length,
	};
};

const packNameOf = (declared: string, source: string) => {
	const name = declared.trim().length > 0 ? declared.trim() : fileNameOf(source).replace(EXTENSION_PATTERN, "");

	return name.slice(0, PACK_NAME_LIMIT);
};

const packVersionOf = (declared: string, sha1: string) => {
	return (declared.length > 0 ? declared : sha1.slice(0, SHORT_SHA1_LENGTH)).slice(0, PACK_VERSION_LIMIT);
};

export const packAddedNotice = (entry: PackEntry): Bridge.Text => {
	const identity = modpackIdentity(entry);

	return {
		ar: `تم رفع مودباك ${entry.name} (${identity})`,
		en: `Uploaded modpack ${entry.name} (${identity})`,
	};
};

export const packKnownNotice = (entry: PackEntry): Bridge.Text => {
	return {
		ar: `مودباك ${entry.name} موجود مسبقًا في مودباكاتك المرفوعة`,
		en: `Modpack ${entry.name} is already in your uploads`,
	};
};

const storePack = async (context: Bridge.Context, source: string): Promise<Bridge.AddOutcome> => {
	const format = packFormatOf(fileNameOf(source));

	if (format === null) {
		throw new BridgeUserError(UNKNOWN_FORMAT);
	}

	const sha1 = (await context.files.digest(source, SHA1_ALGORITHM)).toLowerCase();
	const entries = await readPackIndex(context);
	const known = entries.find((entry) => entry.sha1 === sha1);

	if (known && (await context.files.exists(known.path))) {
		return {
			notice: packKnownNotice(known),
		};
	}

	const declared = await readPackDeclaration(context, source, format);

	const entry: PackEntry = {
		sha1,
		format,
		path: packArchivePath(declared.name, sha1, format),
		name: packNameOf(declared.name, source),
		version: packVersionOf(declared.version, sha1),
		mcVersion: declared.mcVersion,
		variant: declared.variant,
		loaderVersion: declared.loaderVersion,
		fileCount: declared.fileCount,
		sizeBytes: await context.files.size(source),
		uploadedAt: new Date().toISOString(),
	};

	await context.files.ensure(PACKS_DIRECTORY);
	await context.files.move(source, entry.path);
	await writePackIndex(context, [
		...entries.filter((candidate) => candidate.sha1 !== sha1),
		entry,
	]);

	context.log("added an uploaded modpack", {
		name: entry.name,
		format,
		minecraft: entry.mcVersion,
		loader: entry.variant,
		files: entry.fileCount,
	});

	return {
		notice: packAddedNotice(entry),
	};
};

export const modpackUploads: Bridge.Collection = {
	kind: BridgeKind.Collection,

	async list(context) {
		const applied = await appliedPacks(context);
		const rows: Bridge.Row[] = [];

		for (const entry of newestPacksFirst(await readPackIndex(context))) {
			if (!(await context.files.exists(entry.path))) {
				continue;
			}

			rows.push({
				id: entry.sha1,
				name: entry.name,
				version: entry.version,
				mcVersion: entry.mcVersion,
				loader: loaderLabelOf(entry),
				files: entry.fileCount,
				size: formatByteSize(entry.sizeBytes),
				uploadedAt: entry.uploadedAt.slice(0, DATE_LENGTH),
				applied: applied.has(entry.sha1) ? APPLIED_MARK : "",
				path: entry.path,
			});
		}

		return rows;
	},

	async add(context, input) {
		const source = relativeUploadPath(input);

		if (source === null || !isUnder(source, MODPACK_UPLOAD_STAGING) || !(await context.files.exists(source))) {
			throw new BridgeUserError(UPLOAD_NOT_FOUND);
		}

		try {
			return await storePack(context, source);
		} finally {
			await context.files.remove(MANIFEST_STAGING);
			await context.files.remove(source);
		}
	},

	actions: {
		async remove(context, row) {
			const entries = await readPackIndex(context);
			const entry = entries.find((candidate) => candidate.sha1 === row.id);

			if (!entry) {
				throw new BridgeUserError(PACK_MISSING);
			}

			if ((await appliedPacks(context)).has(entry.sha1)) {
				throw new BridgeUserError(PACK_APPLIED);
			}

			await context.files.remove(entry.path);
			await writePackIndex(
				context,
				entries.filter((candidate) => candidate.sha1 !== entry.sha1),
			);

			context.log("removed an uploaded modpack", {
				name: entry.name,
			});
		},
	},

	async unavailable(_context, row): Promise<Bridge.Unavailable> {
		return row.applied === APPLIED_MARK
			? {
					remove: PACK_APPLIED,
				}
			: {};
	},
};
