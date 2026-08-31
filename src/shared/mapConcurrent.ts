export const mapConcurrent = async <Item>(
	items: Item[],
	limit: number,
	run: (item: Item, index: number) => Promise<void>,
) => {
	const width = Math.max(1, Math.min(limit, items.length));
	let cursor = 0;

	const worker = async () => {
		while (cursor < items.length) {
			const index = cursor;

			cursor += 1;

			const item = items[index];

			if (item !== undefined) {
				await run(item, index);
			}
		}
	};

	await Promise.all(
		Array.from(
			{
				length: width,
			},
			worker,
		),
	);
};
