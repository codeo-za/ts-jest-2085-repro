import { buildService } from "./build.service";

(async () => {
    try {
        const
            args = process.argv,
            scriptIndex = args.indexOf(__filename),
            selected = scriptIndex > 0 ? args[ scriptIndex + 1]: null;
        await buildService.updateOverlayRegisterScript(selected);
    } catch (error) {
        if (typeof error === "number") {
            return process.exit(error);
        }
        console.log(error);
        process.exit(-1);
    }
})();
