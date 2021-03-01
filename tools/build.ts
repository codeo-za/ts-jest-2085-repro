import { buildService } from "./build.service";

(async () => {
    try {
        await buildService.build();
    } catch (errorCode) {
        process.exit(errorCode);
    }
})();
