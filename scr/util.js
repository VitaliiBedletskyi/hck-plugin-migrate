const {execSync} = require('node:child_process')

const runCommand = (command) => {
	try {
		execSync(`${command}`, {stdio: 'inherit'});
	} catch (err) {
		console.error(`The command "${command}" failed with an error`, err);
		return false
	}
	return true;
};


module.exports = {
	runCommand,
}
