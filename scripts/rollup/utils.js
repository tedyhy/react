'use strict';

const ncp = require('ncp').ncp;
const join = require('path').join;
const resolve = require('path').resolve;

// 异步 copy
function asyncCopyTo(from, to) {
  return new Promise(_resolve => {
    // 调用 ncp 异步 copy，报错则抛出错误并退出
    ncp(from, to, error => {
      if (error) {
        console.error(error);
        process.exit(1);
      }
      _resolve();
    });
  });
}

// 分析并处理 path
function resolvePath(path) {
  if (path[0] === '~') {
    return join(process.env.HOME, path.slice(1));
  } else {
    return resolve(path);
  }
}

module.exports = {
  asyncCopyTo: asyncCopyTo,
  resolvePath: resolvePath,
};
