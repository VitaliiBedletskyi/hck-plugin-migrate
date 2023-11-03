const { execSync } = require('node:child_process')

const runCommand = (command) => {
    try {
        execSync(`${command}`, { stdio: 'inherit' });
    } catch (err) {
        console.error(`Failed to execute ${command}`, e);
        return false
    }
    return true;
};


module.exports = {
    runCommand,
}