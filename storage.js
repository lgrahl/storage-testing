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

function hasNotification(permission) {
    permission = permission || Notification.permission;
    let color;
    switch (permission) {
        case 'granted':
            color = 'green';
            break;
        case 'default':
            color = 'orange';
            break;
        case 'denied':
        default:
            color = 'red';
            break;
    }
    document.querySelector('#notification').style.color = color;
    console.info(`Notification permission: ${permission}`);
    return permission;
}

async function notification() {
    const permission = await Notification.requestPermission();
    // Google logic: Obviously, if the notification permission has been granted, it can auto-grant persistent storage.
    try {
        isPersistent();
    } catch {}
    return hasNotification(permission);
}

async function getQuotaEstimate() {
    // Get quota estimate
    const estimate = await navigator.storage.estimate();
    console.info(`Quota/Usage: ${Math.round(estimate.quota / 1048576, 2)}/${Math.round(estimate.usage / 1048576, 2)} MiB`);
    return estimate;
}

async function isPersistent() {
    const persisted = await navigator.storage.persisted();
    document.querySelector('#persistent').style.color = persisted ? 'green' : 'red';
    console.info(`Storage: ${persisted ? 'persistent' : 'temporary'}`);
    return persisted;
}

async function persist() {
    const persisted = await navigator.storage.persist();
    document.querySelector('#persistent').style.color = persisted ? 'green' : 'red';
    console.info(`Storage: ${persisted ? 'persistent' : 'temporary'}`);
    return persisted;
}


async function main(persist) {
    // Install service worker
    if (navigator.serviceWorker.controller) {
        console.info('Service Worker already registered');
    } else {
        const registration = await navigator.serviceWorker.register('serviceworker.js', {
            scope: './'
        });
        console.info(`Service Worker registered for scope ${registration.scope}`);
    }

    // Determine initial value of notification button
    try {
        hasNotification();
    } catch {
        console.warn('Could not query whether notification permission has been granted');
    }

    // Determine initial value of persist button
    try {
        await isPersistent();
    } catch {
        console.warn('Could not query whether storage is persistent');
    }

    // Get quota estimate
    try {
        await getQuotaEstimate();
    } catch {
        console.warn('Could not query storage quota');
    }

    // TODO: Verify the data persists even if data is being deleted

    // TODO: Performance test with dexie-encrypted
}

async function getUsage(db) {
    db = db || getDatabase();
    return (await db.rubbish.orderBy('length').keys())
        .reduce((accumulator, length) => accumulator + length, 0);
}

async function populate(target) {
    // Store data
    const db = getDatabase();
    const array = new Uint8Array(10485760); // 10 MiB
    let usage = await getUsage(db);
    console.debug(`Usage at ${Math.round(usage / 1048576, 2)}/${Math.round(target / 1048576, 2)} MiB`);
    try {
        while (usage < target) {
            randomFill(array);
            await db.rubbish.add({
                length: array.byteLength,
                data: array,
            });
            
            usage += array.byteLength;
            console.debug(`Currently at ${Math.round(usage / 1048576, 2)}/${Math.round(target / 1048576, 2)} MiB`);
        }
    } catch (error) {
        console.error(`Failed at ${Math.round(usage / 1048576, 2)}/${Math.round(target / 1048576, 2)} MiB:`, error);
    }
}

async function remove(target) {
    let usage = await getUsage();
    console.debug(`Usage at ${Math.round(usage / 1048576, 2)}/${Math.round(target / 1048576, 2)} MiB`);

    // Remove all data
    const db = getDatabase();
    await db.rubbish.clear();

    usage = await getUsage();
    console.debug(`Usage at ${Math.round(usage / 1048576, 2)}/${Math.round(target / 1048576, 2)} MiB`);
}

function getTarget() {
    // Parse and convert MiB to Bytes
    return parseInt(document.querySelector('#target').value, 10) * 1048576;
}

window.Threema = {
    hasNotification: hasNotification,
    notification: () => notification().catch((error) => console.error(error)),
    isPersistent: () => isPersistent().catch((error) => console.error(error)),
    persist: () => persist().catch((error) => console.error(error)),
    populate: (target) => populate(target || getTarget()).catch((error) => console.error(error)),
    remove: (target) => remove(target || getTarget()).catch((error) => console.error(error)),
    usage: (target) => getUsage()
        .then((usage) => console.debug(`Usage at ${Math.round(usage / 1048576, 2)}/${Math.round((target || getTarget()) / 1048576, 2)} MiB`))
        .catch((error) => console.error(error)),
};
main().catch((error) => console.error(error));

