const {NodeFS} = require(`@berry/fslib`);
const {
  exec: {execFile},
  fs: {writeFile, mkdirp},
} = require('pkg-tests-core');

describe(`Commands`, () => {
  describe(`stage`, () => {
    test(
      `it should stage the initial files`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await execFile(`git`, [`init`], {cwd: path});
        await writeFile(`${path}/.yarnrc`, `plugins:\n  - ${JSON.stringify(require.resolve(`@berry/monorepo/scripts/plugin-stage.js`))}\n`);

        await expect(run(`stage`, `-n`, {cwd: path})).resolves.toMatchObject({
          stdout: [
            `${NodeFS.fromPortablePath(`${path}/.yarnrc`)}\n`,
            `${NodeFS.fromPortablePath(`${path}/package.json`)}\n`,
          ].join(``),
        });
      }),
    );

    test(
      `it should not stage non-yarn files`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await execFile(`git`, [`init`], {cwd: path});
        await writeFile(`${path}/.yarnrc`, `plugins:\n  - ${JSON.stringify(require.resolve(`@berry/monorepo/scripts/plugin-stage.js`))}\n`);

        await writeFile(`${path}/index.js`, `module.exports = 42;\n`);

        await expect(run(`stage`, `-n`, {cwd: path})).resolves.toMatchObject({
          stdout: [
            `${NodeFS.fromPortablePath(`${path}/.yarnrc`)}\n`,
            `${NodeFS.fromPortablePath(`${path}/package.json`)}\n`,
          ].join(``),
        });
      }),
    );

    test(
      `it should stage the cache folder`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await execFile(`git`, [`init`], {cwd: path});
        await writeFile(`${path}/.yarnrc`, `plugins:\n  - ${JSON.stringify(require.resolve(`@berry/monorepo/scripts/plugin-stage.js`))}\n`);

        await expect(run(`stage`, `-n`, {cwd: path})).resolves.toMatchObject({
          stdout: [
            `${NodeFS.fromPortablePath(`${path}/.pnp.js`)}\n`,
            `${NodeFS.fromPortablePath(`${path}/.yarn/build-state.yml`)}\n`,
            `${NodeFS.fromPortablePath(`${path}/.yarn/cache/.gitignore`)}\n`,
            `${NodeFS.fromPortablePath(`${path}/.yarn/cache/no-deps-npm-1.0.0-7b98016e4791f26dcb7dcf593c5483002916726a04cbeec6eb2ab72d35ed3c1e.zip`)}\n`,
            `${NodeFS.fromPortablePath(`${path}/.yarnrc`)}\n`,
            `${NodeFS.fromPortablePath(`${path}/package.json`)}\n`,
            `${NodeFS.fromPortablePath(`${path}/yarn.lock`)}\n`,
          ].join(``),
        });
      }),
    );

    test(
      `it should commit with right messages`,
      makeTemporaryEnv({
        name: `my-commit-package`,
        dependencies: {
          [`deps1`]: `1.0.0`,
          [`deps2`]: `2.0.0`
        },
      }, async ({path, run, source}) => {
        await execFile(`git`, [`init`], {cwd: path});
        await writeFile(`${path}/.yarnrc`, `plugins:\n  - ${JSON.stringify(require.resolve(`@berry/monorepo/scripts/plugin-stage.js`))}\n`);

        await mkdirp(`${path}/new-package`);
        await run(`${path}/new-package`, `init`);

        await expect(run(`stage`, `-c`, `-n`, {cwd: path})).resolves.toMatchObject({
          stdout: `Creates new-package, Creates my-commit-package\n`
        });

        await execFile(`git`, [`add`, `.`], {cwd: path});
        await execFile(`git`, [`commit`, `-m`, `'did this'`], {cwd: path});
        await writeFile(`${path}/package.json`, `${
          JSON.stringify({
            name: `my-commit-package`,
            dependencies: {
              [`deps1`]: `2.0.0`,
              [`deps3`]: `2.0.0`
            },
          })
        }\n`);
        await execFile(`rm`, [`${path}/new-package/package.json`], {cwd: path})

        await expect(run(`stage`, `-c`, `-n`, {cwd: path})).resolves.toMatchObject({
          stdout: `Adds deps3, Removes deps2, Updates deps1 to 2.0.0, Deletes new-package\n`
        });
      }),
    );
  });
});
