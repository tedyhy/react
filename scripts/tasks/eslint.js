/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

var path = require('path');
var spawn = require('child_process').spawn;

// 根据平台获取执行文件后缀
var extension = process.platform === 'win32' ? '.cmd' : '';

// 通过 spawn 调用执行 node_modules/.bin/eslint 命令文件
// 根据 .eslintrc.js 语法配置信息，对项目中 js 文件做校验
spawn(
  path.join('node_modules', '.bin', 'eslint' + extension),
  ['.', '--max-warnings=0'],
  {
    // Allow colors to pass through
    stdio: 'inherit',
  }
).on('close', function(code) {
  if (code !== 0) {
    console.error('Lint failed');
  } else {
    console.log('Lint passed');
  }

  process.exit(code);
});
