const fsPromises = require('node:fs/promises')
const fs = require('node:fs')

const readJsonFile = async (path) => {
    const fileContent = await fsPromises.readFile(path);
    return JSON.parse(fileContent.toString());
};

const writeJsonFile = async (path, data) => {
    await fsPromises.writeFile(path, JSON.stringify(data, null, 4));
};

const remove = async (path) => {
    if (!fs.existsSync(path)) {
        return;
    }
    await fsPromises.rm(path, { recursive: true, force: true,  });
}

module.exports = {
    readJsonFile,
    writeJsonFile,
    remove,
}