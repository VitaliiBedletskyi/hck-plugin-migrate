const path = require('node:path')
const fs = require('node:fs')
const {readJsonFile, writeJsonFile, remove} = require("./fsClient");
const {runCommand} = require("./util");
const {cp} = require("fs/promises");

const PACKAGE_JSON_FILE_NAME = 'package.json';
const PACKAGE_LOCK_JSON_FILE_NAME = 'package-lock.json';
const NODE_MODULES_FOLDER_NAME = 'node_modules';

const run = async () => {
    const pluginRepoPath = path.resolve(process.argv[3] || '.');

    console.log('Moving all dependencies to root package.json file and add additional configs');
    await fillRootPackageJson(pluginRepoPath);

    console.log('Removing node_modules from FE and RE folders');
    await remove(path.join(pluginRepoPath, 'forward_engineering', NODE_MODULES_FOLDER_NAME));
    await remove(path.join(pluginRepoPath, 'reverse_engineering', NODE_MODULES_FOLDER_NAME));

    console.log('Removing package-lock.json if exists from FE and RE folders');
    await remove(path.join(pluginRepoPath, 'forward_engineering', PACKAGE_LOCK_JSON_FILE_NAME));
    await remove(path.join(pluginRepoPath, 'reverse_engineering', PACKAGE_LOCK_JSON_FILE_NAME));

    console.log('Installing dev dependencies')
    const installDevDepsCommand = 'npm i -D esbuild esbuild-plugin-clean eslint eslint-config-prettier eslint-plugin-prettier lint-staged prettier simple-git-hooks @hackolade/hck-esbuild-plugins-pack'
    const installDeps = runCommand(installDevDepsCommand);

    if (!installDeps) {
        process.exit(-1);
    }

    console.log('Installing git hooks')
    const installGitHooks = runCommand('npx simple-git-hooks');

    if (!installGitHooks) {
        process.exit(-1);
    }

    console.log('Copying required configs to plugin repository')
    await cp(path.resolve(__dirname, '..', 'required_configs'), pluginRepoPath, { recursive: true });

    console.log('Running prettier for JSON files')
    runCommand('npx prettier ./**/*.json --write');

    console.log('Running prettier for JS files')
    runCommand('npx prettier ./**/*.js --write');

    console.log('Running ESLint');
    runCommand('npm run lint');

    console.log('Migration successfully finished');
};


const pickPackageJsonDependencies = async (packageJsonPath) => {
    const packageJsonData = await readJsonFile(packageJsonPath)
    const dependenciesList = packageJsonData.dependencies || {};

    const resultPackageJson = Object.keys(packageJsonData)
        .filter(key => key !== 'dependencies')
        .reduce((resultJsonConfig, key) => ({...resultJsonConfig, [key]: packageJsonData[key]}), {});

    await writeJsonFile(packageJsonPath, resultPackageJson)

    return dependenciesList;
};

const fillRootPackageJsonByDependencies = async (pluginRepoPath, rootPackageJsonConfig) => {
    const fePackageJsonPath = path.join(pluginRepoPath, 'forward_engineering', PACKAGE_JSON_FILE_NAME);
    const rePackageJsonPath = path.join(pluginRepoPath, 'reverse_engineering', PACKAGE_JSON_FILE_NAME);

    const feDeps = fs.existsSync(fePackageJsonPath)
        ? await pickPackageJsonDependencies(fePackageJsonPath)
        : {};
    const reDeps = fs.existsSync(rePackageJsonPath)
        ? await pickPackageJsonDependencies(rePackageJsonPath)
        : {};

    return {
        ...rootPackageJsonConfig,
        dependencies: {
            ...feDeps,
            ...reDeps,
        }
    }
};

const fillRootPackageJsonByAdditionalConfigs = (rootPackageJsonConfig) => {
    return {
        ...rootPackageJsonConfig,
        'lint-staged': {
            '*.{js,json}': 'prettier --write'
        },
        'simple-git-hooks': {
            'pre-commit': 'npx lint-staged',
            'pre-push': 'npx eslint .'
        },
        scripts: {
            lint: 'eslint . --max-warnings=0',
            package: 'node esbuild.package.js'
        }
    }
};

const fillRootPackageJson = async (pluginRepoPath) => {
    const rootPackageJsonPath = path.join(pluginRepoPath, PACKAGE_JSON_FILE_NAME);
    const rootPackageJsonConfig = await readJsonFile(rootPackageJsonPath);


    const packageJsonWithDependencies = await fillRootPackageJsonByDependencies(pluginRepoPath, rootPackageJsonConfig);
    const resultPackageJsonConfig = fillRootPackageJsonByAdditionalConfigs(packageJsonWithDependencies);

    await writeJsonFile(rootPackageJsonPath, resultPackageJsonConfig);
};

module.exports = {
    run,
}
