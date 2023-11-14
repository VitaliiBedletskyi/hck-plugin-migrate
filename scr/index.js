const path = require('node:path')
const fs = require('node:fs')
const {readJsonFile, writeJsonFile, remove} = require("./fsClient");
const {runCommand, log} = require("./util");
const {cp} = require("fs/promises");

const PACKAGE_JSON_FILE_NAME = 'package.json';
const PACKAGE_LOCK_JSON_FILE_NAME = 'package-lock.json';
const NODE_MODULES_FOLDER_NAME = 'node_modules';

const run = async () => {
	const pluginRepoPath = path.resolve(process.argv[3] || '.');

	log.info('Moving all dependencies to root package.json file and add additional configs');
	await fillRootPackageJson(pluginRepoPath);

	log.info('Removing node_modules from FE and RE folders');
	await remove(path.join(pluginRepoPath, 'forward_engineering', NODE_MODULES_FOLDER_NAME));
	await remove(path.join(pluginRepoPath, 'reverse_engineering', NODE_MODULES_FOLDER_NAME));

	log.info('Removing package-lock.json if exists from FE and RE folders');
	await remove(path.join(pluginRepoPath, 'forward_engineering', PACKAGE_LOCK_JSON_FILE_NAME));
	await remove(path.join(pluginRepoPath, 'reverse_engineering', PACKAGE_LOCK_JSON_FILE_NAME));

	log.info('Installing dev dependencies')
	const installDevDepsCommand = 'npm i -D --save-exact esbuild esbuild-plugin-clean eslint eslint-config-prettier eslint-plugin-prettier lint-staged@14.0.1 prettier simple-git-hooks @hackolade/hck-esbuild-plugins-pack'
	const installDeps = runCommand(installDevDepsCommand);

	if (!installDeps) {
		process.exit(-1);
	}

	log.info('Installing git hooks')
	const installGitHooks = runCommand('npx simple-git-hooks');

	if (!installGitHooks) {
		process.exit(-1);
	}

	log.info('Copying required configs to plugin repository')
	await cp(path.resolve(__dirname, '..', 'required_configs'), pluginRepoPath, {recursive: true});

	log.info('Running prettier for JS and JSON files')
	runCommand('npx prettier "./**/*.{js,json}" --write');

	log.info('Running ESLint');
	runCommand('npm run lint');

	log.success('Migration successfully finished!!! 💪');
};

const fixPackageVersion = (version) => {
	return version.replace(/^[\^~*x]?/, '');
};

const allowOnlyPatchUpdatesForNpmPackages = (packages) => {
	return Object.keys(packages)
		.reduce((resultPackages, packageName) => {
			return {
				...resultPackages,
				[packageName]: fixPackageVersion(packages[packageName]),
			}
		}, {});
};

const pickPackageJsonDependencies = async (packageJsonPath) => {
	const packageJsonData = await readJsonFile(packageJsonPath)
	const dependenciesList = allowOnlyPatchUpdatesForNpmPackages(packageJsonData.dependencies || {});

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

const getBumpedVersion = (version = '') => {
	const versionParts = version.split('.');
	const major = parseInt(versionParts[0]);
	const minor = parseInt(versionParts[1]);
	const patch = parseInt(versionParts[2]) + 1;
	return `${major}.${minor}.${patch}`;
}

const bumpPluginPatchVersion = (packageJsonConfig) => {
	return {
		...packageJsonConfig,
		version: getBumpedVersion(packageJsonConfig.version),
	}
}

const fillRootPackageJson = async (pluginRepoPath) => {
	const rootPackageJsonPath = path.join(pluginRepoPath, PACKAGE_JSON_FILE_NAME);
	const rootPackageJsonConfig = await readJsonFile(rootPackageJsonPath);

	const packageJsonWithDependencies = await fillRootPackageJsonByDependencies(pluginRepoPath, rootPackageJsonConfig);
	const resultPackageJsonConfig = fillRootPackageJsonByAdditionalConfigs(packageJsonWithDependencies);

	await writeJsonFile(rootPackageJsonPath, bumpPluginPatchVersion(resultPackageJsonConfig));
};

module.exports = {
	run,
}
