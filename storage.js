//import Dexie from 'dexie';

function randomFill(array) {
    for (let offset = array.byteOffset; offset < array.byteLength; offset += 65536) {
        const length = Math.min(array.byteLength - offset, 65536);
        const view = new Uint8Array(array.buffer, offset, length);
        crypto.getRandomValues(view);
    }
}

function getDatabase() {
    const db = new Dexie('RubbishDatabase');
    db.version(1).stores({
        rubbish: '++id,length',
    });
    return db;
}


async function main() {
    // Get quota estimate
    let estimate = await navigator.storage.estimate();
    console.info(`Quota/Usage: ${Math.round(estimate.quota / 1048576, 2)}/${Math.round(estimate.usage / 1048576, 2)} MiB`);

    // Ask for permission to store persistently
    if (await navigator.storage.persisted()) {
        console.info('Already persistent');
    } else {
        const persisted = await navigator.storage.persist();
        if (persisted) {
            console.info('Persistent');
        } else {
            console.info('Temporary');
        }
    }

    // Get quota estimate (after persisted)
    estimate = await navigator.storage.estimate();
    console.info(`Quota/Usage: ${Math.round(estimate.quota / 1048576, 2)}/${Math.round(estimate.usage / 1048576, 2)} MiB`);

    // TODO: Verify the data persists even if data is being deleted

    // TODO: Performance test with dexie-encrypted
}

async function getUsage(db) {
    db = db || getDatabase();
    return (await db.rubbish.orderBy('length').keys())
        .reduce((accumulator, length) => accumulator + length, 0);
}

async function populate() {
    // Store 12 GiB of data
    const db = getDatabase();
    const array = new Uint8Array(10485760); // 10 MiB
    let usage = await getUsage(db);
    console.debug(`Usage at ${Math.round(usage / 1048576, 2)}/${Math.round(window.Threema.TARGET / 1048576, 2)} MiB`);
    try {
        while (usage < TARGET) {
            randomFill(array);
            await db.rubbish.add({
                length: array.byteLength,
                data: array,
            });
            
            usage += array.byteLength;
            console.debug(`Currently at ${Math.round(usage / 1048576, 2)}/${Math.round(window.Threema.TARGET / 1048576, 2)} MiB`);
        }
    } catch (error) {
        console.error(`Failed at ${Math.round(usage / 1048576, 2)}/${Math.round(window.Threema.TARGET / 1048576, 2)} MiB:`, error);
    }
}

async function remove() {
    let usage = await getUsage();
    console.debug(`Usage at ${Math.round(usage / 1048576, 2)}/${Math.round(window.Threema.TARGET / 1048576, 2)} MiB`);

    // Remove all data
    const db = getDatabase();
    await db.rubbish.clear();

    usage = await getUsage();
    console.debug(`Usage at ${Math.round(usage / 1048576, 2)}/${Math.round(window.Threema.TARGET / 1048576, 2)} MiB`);
}

window.Threema = {
    TARGET: 12884901888, // 12 GiB
    populate: () => populate().catch((error) => console.error(error)),
    remove: () => remove().catch((error) => console.error(error)),
    usage: () => getUsage()
        .then((usage) => console.debug(`Usage at ${Math.round(usage / 1048576, 2)}/${Math.round(window.Threema.TARGET / 1048576, 2)} MiB`))
        .catch((error) => console.error(error)),
};
main().catch((error) => console.error(error));

