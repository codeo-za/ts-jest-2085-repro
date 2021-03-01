import { buildService } from "./build.service";

(async () => {
    try {
        await buildService.test();
    } catch (errorCode) {
        process.exit(errorCode);
    }
})();
