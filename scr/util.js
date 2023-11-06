const {execSync} = require('node:child_process')

const runCommand = (command) => {
	try {
		execSync(`${command}`, {stdio: 'inherit'});
	} catch (err) {
		log.error(`The command "${command}" failed with an error`, err);
		return false
	}
	return true;
};

const RESET = "\x1b[0m";
const PACKAGE_PREFIX = "[hck-plugin-migrate]: ";

const log = {
	info: (text) => console.log("\x1b[34m" + PACKAGE_PREFIX + text + RESET),
	success: (text) => console.log("\x1b[32m" + PACKAGE_PREFIX + text + RESET),
	warning: (text) => console.log("\x1b[33m" + PACKAGE_PREFIX + text + RESET),
	error: (text, error) => console.log("\x1b[31m" + PACKAGE_PREFIX + text + RESET, error),
};


module.exports = {
	runCommand,
	log,
}
