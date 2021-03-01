/* tslint:disable:no-console */

import { register } from "register-service-worker";

function registerServiceWorker() {
    register(`${process.env.BASE_URL}service-worker.js`, {
        registrationOptions: {
            scope: "./"
        },
        ready() {
            console.log(
                "App is being served from cache by a service worker.\n" +
                "For more details, visit https://goo.gl/AFskqB",
            );
        },
        cached() {
            console.log("Content has been cached for offline use.");
        },
        updated() {
            console.log("New content is available; please refresh.");
        },
        offline() {
            console.log("No internet connection found. App is running in offline mode.");
        },
        error(error) {
            console.error("Error during service worker registration:", {
                error,
                message: error.message,
                stack: error.stack
            });
        },
    });
}

async function clearIndexHtmlFromCache() {
    if (window.caches) {
        const cacheKeys = await window.caches.keys();
        for (const ck of cacheKeys) {
            const
                cache = await window.caches.open(ck),
                cachedItems = await cache.keys(),
                urls = cachedItems.map(o => o.url)
                    .filter(url => {
                        const parts = url.split("/");
                        return parts[parts.length - 1] === "index.html";
                    });
            for (const url of urls) {
                const cleared = await cache.delete(url);
                if (window.location.toString().indexOf("demo") > -1) {
                    console.log(
                        `${cleared ? "Cleared" : "Failed to clear"} cached item ${url}`);
                }
            }
        }
    }
}

if (process.env.NODE_ENV === "production") {
    (async () => {
        await clearIndexHtmlFromCache();
        registerServiceWorker();
    })();
}

