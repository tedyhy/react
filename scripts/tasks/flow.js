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

// 通过 spawn 调用执行 node_modules/.bin/flow 命令文件，对 flow 语法进行校验
// 根据 .flowconfig 内配置信息，对项目中 flow 类型做校验，有错误信息则输出
spawn(path.join('node_modules', '.bin', 'flow' + extension), ['check', '.'], {
  // Allow colors to pass through
  stdio: 'inherit',
}).on('close', function(code) {
  if (code !== 0) {
    console.error('Flow failed');
  } else {
    console.log('Flow passed');
  }

  process.exit(code);
});
