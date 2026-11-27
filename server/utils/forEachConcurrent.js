const DEFAULT_EMAIL_CONCURRENCY = 5;

const forEachConcurrent = async (items, handler, concurrency = DEFAULT_EMAIL_CONCURRENCY) => {
    let nextIndex = 0;
    const errors = [];
    const workerCount = Math.min(Math.max(1, concurrency), items.length);

    await Promise.all(Array.from({ length: workerCount }, async () => {
        while (nextIndex < items.length) {
            const index = nextIndex;
            nextIndex += 1;
            try {
                await handler(items[index], index);
            } catch (error) {
                errors.push(error);
            }
        }
    }));

    if (errors.length) throw errors[0];
};

module.exports = { DEFAULT_EMAIL_CONCURRENCY, forEachConcurrent };
