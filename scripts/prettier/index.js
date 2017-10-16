/**
 * Copyright (c) 2014-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
'use strict';

// Based on similar script in Jest
// https://github.com/facebook/jest/blob/master/scripts/prettier.js

const chalk = require('chalk');
const glob = require('glob');
const path = require('path');
const execFileSync = require('child_process').execFileSync;

const mode = process.argv[2] || 'check';
const shouldWrite = mode === 'write' || mode === 'write-changed';
const onlyChanged = mode === 'check-changed' || mode === 'write-changed';

// 判断平台，根据平台调用不同命令
const isWindows = process.platform === 'win32';
const prettier = isWindows ? 'prettier.cmd' : 'prettier';
// 找到 node_modules/.bin/prettier 执行文件
const prettierCmd = path.resolve(
  __dirname,
  '../../node_modules/.bin/' + prettier
);
// prettier 默认选项
const defaultOptions = {
  'bracket-spacing': 'false',
  'single-quote': 'true',
  'jsx-bracket-same-line': 'true',
  'trailing-comma': 'all',
  'print-width': 80,
};
const config = {
  default: {
    patterns: ['src/**/*.js'],
    ignore: ['**/third_party/**', '**/node_modules/**'],
  },
  scripts: {
    patterns: ['scripts/**/*.js', 'fixtures/**/*.js'],
    ignore: ['scripts/bench/benchmarks/**'],
    options: {
      'trailing-comma': 'es5',
    },
  },
};

// 子线程同步执行命令
function exec(command, args) {
  console.log('> ' + [command].concat(args).join(' '));
  var options = {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'pipe',
    encoding: 'utf-8',
  };
  // 调用 execFileSync 方法同步执行命令
  return execFileSync(command, args, options);
}

// 获取 hash 值
var mergeBase = exec('git', ['merge-base', 'HEAD', 'master']).trim();
// git diff 拿到修改的文件集合
var changedFiles = new Set(
  exec('git', [
    'diff',
    '-z',
    '--name-only',
    '--diff-filter=ACMRTUB',
    mergeBase,
  ]).match(/[^\0]+/g)
);

// 遍历配置 config
Object.keys(config).forEach(key => {
  const patterns = config[key].patterns;
  const options = config[key].options;
  const ignore = config[key].ignore;

  // 拼接 glob 模式，过滤出来哪些文件有改动
  const globPattern = patterns.length > 1
    ? `{${patterns.join(',')}}`
    : `${patterns.join(',')}`;
  const files = glob
    .sync(globPattern, {ignore})
    .filter(f => !onlyChanged || changedFiles.has(f));

  // 判断有没有文件改动
  if (!files.length) {
    return;
  }

  // 拼接 prettier 选项
  const args = Object.keys(defaultOptions).map(
    k => `--${k}=${(options && options[k]) || defaultOptions[k]}`
  );
  args.push(`--${shouldWrite ? 'write' : 'l'}`);

  // 执行 prettier 命令格式化所有修改过的 js 代码
  try {
    exec(prettierCmd, [...args, ...files]).trim();
  } catch (e) {
    if (!shouldWrite) {
      console.log(
        '\n' +
          chalk.red(
            `  This project uses prettier to format all JavaScript code.\n`
          ) +
          chalk.dim(`    Please run `) +
          chalk.reset('yarn prettier-all') +
          chalk.dim(` and add changes to files listed below to your commit:`) +
          `\n\n` +
          e.stdout
      );
      process.exit(1);
    }
    throw e;
  }
});
