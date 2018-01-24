// 此测试脚本没用到
'use strict';

const path = require('path');
const spawn = require('child_process').spawn;
// 分析参数
const argv = require('minimist')(process.argv.slice(2));

console.log('Running Jest');

// 使用 jest-cli 模块执行测试脚本
const args = [
  path.join('node_modules', 'jest-cli', 'bin', 'jest'),
  '--runInBand',
];
// 测试覆盖率
if (argv.coverage) {
  args.push('--coverage');
}

// 执行测试
const jest = spawn('node', args, {
  stdio: 'inherit',
  env: Object.assign({}, process.env, {
    NODE_ENV: 'test',
  }),
});

// 测试完毕根据测试结果输出日志
jest.on('close', code => {
  if (code === 1) {
    console.error('Jest failed!');
  } else {
    console.log('Jest passed!');
  }
  process.exit(code);
});
