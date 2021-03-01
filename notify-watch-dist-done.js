const notifier = require("node-notifier");

notifier.notify({
        title: "Dist site refreshed!",
        message: "Your wait is over!",
        sound: true
});
