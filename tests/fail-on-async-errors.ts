import * as fs from "fs";
import chalk from "chalk";

const check = "async-errors";

function main() {
    if (!fs.existsSync(check)) {
        return 0;
    }
    console.error(chalk.redBright(
        `
============ DANGER, WILL ROBINSON! ============

  One or more async failures occurred. Perhaps
  there's a 'describe' block with test code in
  it? The error(s) should have been reported
  above and will be logged in the folder:
  ${ check }

================================================


`));
    return 42;
}

process.exit(main());
