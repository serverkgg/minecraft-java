export interface BanEntry {
	name: string;
	source: string;
	reason: string;
}

const LOG_PREFIX = /^(?:\[[^\]]*\]\s*)+:\s*/;

const HEADER_LINE = /^There are (?<count>\d+) ban(?:s|\(s\)):$/;

const EMPTY_LINE = /^There are no bans\.?$/;

const ENTRY_LINE = /^(?<name>.+?) was banned by (?<source>.+?): (?<reason>.*)$/;

const readable = (line: string) => {
	return line.replace(LOG_PREFIX, "").trim();
};

export const parseBanList = (reply: string): BanEntry[] => {
	const lines = reply.split("\n").map(readable);
	const start = lines.findLastIndex((line) => {
		return HEADER_LINE.test(line) || EMPTY_LINE.test(line);
	});

	if (start < 0) {
		return [];
	}

	const header = HEADER_LINE.exec(lines.at(start) ?? "");
	const count = Number(header?.groups?.count ?? "0");
	const entries: BanEntry[] = [];

	for (const line of lines.slice(start + 1)) {
		if (entries.length >= count) {
			break;
		}

		const groups = ENTRY_LINE.exec(line)?.groups;

		if (!groups?.name || !groups.source || groups.reason === undefined) {
			continue;
		}

		entries.push({
			name: groups.name,
			source: groups.source,
			reason: groups.reason,
		});
	}

	return entries;
};
