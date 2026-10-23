import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { execDetail } from "@serverkgg/bridge/utils";
import { type Byte, type Compound, type NBT, parse, type String as Text, writeUncompressed } from "prismarine-nbt";
import { STAGING_ROOT } from "../shared";
import { LEVEL_FILE } from "./world";

const EXEC_TIMEOUT_MS = 10_000;

const LEVEL_STAGING = `${STAGING_ROOT}/level`;

const DATA_TAG = "Data";

const DIFFICULTY_SETTINGS_TAG = "difficulty_settings";

const HARD_DIFFICULTY = 3;

const HARD_DIFFICULTY_NAME = "hard";

const WORLD_GEN_SETTINGS_FILE = "data/minecraft/world_gen_settings.dat";

const WORLD_GEN_SETTINGS_TAG = "WorldGenSettings";

const SEED_TAG = "seed";

const RANDOM_SEED_TAG = "RandomSeed";

export enum LevelLayout {
	Classic = "classic",
	DifficultySettings = "difficultySettings",
}

const STOP_FIRST: Bridge.Text = {
	ar: "وقّف السيرفر قبل تغيير الهاردكور لحماية ملفات الماب.",
	en: "Stop the server before changing hardcore to protect the world's files.",
};

const UNREADABLE_LEVEL: Bridge.Text = {
	ar: "تعذّرت قراءة ملف الماب level.dat، لذلك لم يتغيّر الهاردكور. رجّع نسخة احتياطية وجرب مرة ثانية.",
	en: "We couldn't read the world's level.dat, so hardcore wasn't changed. Restore a backup and try again.",
};

const UNKNOWN_LAYOUT: Bridge.Text = {
	ar: "تعذّر العثور على إعداد الهاردكور في ملف الماب level.dat، لذلك لم يتغيّر. شغّل سيرفرك مرة ليحدّث ماينكرافت الماب، ثم وقّفه وجرب مرة ثانية.",
	en: "We couldn't find the hardcore setting in the world's level.dat, so it wasn't changed. Start your server once so Minecraft updates the world, then stop it and try again.",
};

type Entries = Compound["value"];

const byteTag = (value: number): Byte => ({
	type: "byte",
	value,
});

const textTag = (value: string): Text => ({
	type: "string",
	value,
});

const compoundTag = (value: Entries): Compound => ({
	type: "compound",
	value,
});

const compoundOf = (entries: Entries, key: string) => {
	const tag = entries[key];

	return tag?.type === "compound" ? tag.value : null;
};

const flagOf = (entries: Entries, key: string) => {
	const tag = entries[key];

	return tag?.type === "byte" ? tag.value !== 0 : null;
};

const longOf = (entries: Entries, key: string) => {
	const tag = entries[key];

	if (tag?.type !== "long") {
		return null;
	}

	const [high, low] = tag.value;

	return BigInt.asIntN(64, (BigInt(high) << 32n) | BigInt(low >>> 0)).toString();
};

export const levelLayout = (level: NBT): LevelLayout | null => {
	const data = compoundOf(level.value, DATA_TAG);

	if (data === null) {
		return null;
	}

	if (compoundOf(data, DIFFICULTY_SETTINGS_TAG) !== null) {
		return LevelLayout.DifficultySettings;
	}

	return flagOf(data, "hardcore") === null ? null : LevelLayout.Classic;
};

export const levelHardcore = (level: NBT): boolean | null => {
	const data = compoundOf(level.value, DATA_TAG);
	const layout = levelLayout(level);

	if (data === null || layout === null) {
		return null;
	}

	if (layout === LevelLayout.Classic) {
		return flagOf(data, "hardcore");
	}

	return flagOf(compoundOf(data, DIFFICULTY_SETTINGS_TAG) ?? {}, "hardcore") ?? false;
};

export const levelSeed = (level: NBT): string | null => {
	const data = compoundOf(level.value, DATA_TAG);

	if (data === null) {
		return null;
	}

	return longOf(compoundOf(data, WORLD_GEN_SETTINGS_TAG) ?? {}, SEED_TAG) ?? longOf(data, RANDOM_SEED_TAG);
};

export const worldGenSeed = (settings: NBT): string | null => {
	const direct = longOf(settings.value, SEED_TAG);

	if (direct !== null) {
		return direct;
	}

	for (const key of Object.keys(settings.value)) {
		const seed = longOf(compoundOf(settings.value, key) ?? {}, SEED_TAG);

		if (seed !== null) {
			return seed;
		}
	}

	return null;
};

const withData = (level: NBT, data: Entries): NBT => ({
	...level,
	value: {
		...level.value,
		[DATA_TAG]: compoundTag(data),
	},
});

export const withHardcore = (level: NBT, enabled: boolean): NBT | null => {
	const data = compoundOf(level.value, DATA_TAG);
	const layout = levelLayout(level);
	const flag = byteTag(enabled ? 1 : 0);

	if (data === null || layout === null) {
		return null;
	}

	if (layout === LevelLayout.Classic) {
		return withData(level, {
			...data,
			hardcore: flag,
			DifficultyLocked: flag,
			...(enabled
				? {
						Difficulty: byteTag(HARD_DIFFICULTY),
					}
				: {}),
		});
	}

	return withData(level, {
		...data,
		[DIFFICULTY_SETTINGS_TAG]: compoundTag({
			...(compoundOf(data, DIFFICULTY_SETTINGS_TAG) ?? {}),
			...(enabled
				? {
						difficulty: textTag(HARD_DIFFICULTY_NAME),
					}
				: {}),
			hardcore: flag,
			locked: flag,
		}),
	});
};

export const parseLevel = async (bytes: Uint8Array): Promise<NBT | null> => {
	try {
		const { parsed, metadata } = await parse(Buffer.from(bytes), "big");
		const read = metadata.buffer.subarray(0, metadata.size);

		return Buffer.compare(writeUncompressed(parsed, "big"), read) === 0 ? parsed : null;
	} catch {
		return null;
	}
};

export const serializeLevel = (level: NBT) => {
	return Bun.gzipSync(new Uint8Array(writeUncompressed(level, "big")));
};

const levelPath = (world: string) => `${world}/${LEVEL_FILE}`;

const worldGenSettingsPath = (world: string) => `${world}/${WORLD_GEN_SETTINGS_FILE}`;

const readLevelBytes = async (context: Bridge.Context, path: string) => {
	if (!(await context.files.exists(path))) {
		return null;
	}

	const result = await context.exec(
		[
			"base64",
			"-w",
			"0",
			"--",
			path,
		],
		{
			timeoutMs: EXEC_TIMEOUT_MS,
		},
	);

	if (result.code !== 0) {
		context.log.warn("could not read a level file", {
			path,
			code: result.code,
		});

		return null;
	}

	return new Uint8Array(Buffer.from(result.stdout.trim(), "base64"));
};

const readLevel = async (context: Bridge.Context, path: string) => {
	const bytes = await readLevelBytes(context, path);

	return bytes === null ? null : await parseLevel(bytes);
};

const writeLevel = async (context: Bridge.Context, path: string, next: Uint8Array) => {
	const encoded = `${LEVEL_STAGING}/${LEVEL_FILE}.b64`;
	const staged = `${LEVEL_STAGING}/${LEVEL_FILE}`;
	const previous = `${LEVEL_STAGING}/previous.dat`;

	await context.files.remove(LEVEL_STAGING);
	await context.files.ensure(LEVEL_STAGING);

	try {
		await context.files.write(encoded, Buffer.from(next).toString("base64"));

		const decoded = await context.exec(
			[
				"sh",
				"-c",
				'base64 -d -- "$1" > "$2"',
				"write-level",
				encoded,
				staged,
			],
			{
				timeoutMs: EXEC_TIMEOUT_MS,
			},
		);

		if (decoded.code !== 0) {
			throw new Error(`could not stage the level file: ${execDetail(decoded)}`);
		}

		const written = await readLevelBytes(context, staged);

		if (written === null || Buffer.compare(written, next) !== 0) {
			throw new Error("the staged level file does not match what we meant to write");
		}

		await context.files.move(path, previous);

		try {
			await context.files.move(staged, path);
		} catch (error) {
			await context.files.move(previous, path);
			throw error;
		}
	} finally {
		await context.files.remove(LEVEL_STAGING);
	}
};

export const readWorldHardcore = async (context: Bridge.Context, world: string): Promise<boolean | null> => {
	const level = await readLevel(context, levelPath(world));

	return level === null ? null : levelHardcore(level);
};

export const readWorldSeed = async (context: Bridge.Context, world: string): Promise<string | null> => {
	const settings = await readLevel(context, worldGenSettingsPath(world));
	const generated = settings === null ? null : worldGenSeed(settings);

	if (generated !== null) {
		return generated;
	}

	const level = await readLevel(context, levelPath(world));

	return level === null ? null : levelSeed(level);
};

export const setWorldHardcore = async (context: Bridge.Context, world: string, enabled: boolean) => {
	if (context.server.running) {
		throw new BridgeUserError(STOP_FIRST);
	}

	const path = levelPath(world);
	const level = await readLevel(context, path);

	if (level === null) {
		throw new BridgeUserError(UNREADABLE_LEVEL);
	}

	const next = withHardcore(level, enabled);

	if (next === null) {
		throw new BridgeUserError(UNKNOWN_LAYOUT);
	}

	if (levelHardcore(level) === enabled) {
		return false;
	}

	await writeLevel(context, path, serializeLevel(next));

	context.log(enabled ? "turned on hardcore for the world" : "turned off hardcore for the world", {
		world,
		layout: levelLayout(level),
	});

	return true;
};
