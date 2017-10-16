#### package.json
```
// 通过 prettier 美化代码
"prettier": "node ./scripts/prettier/index.js write-changed",
"prettier-all": "node ./scripts/prettier/index.js write",
// 校验 react|react-dom|react-test-renderer|ReactVersion 的版本号是否跟 package.json 的一致
"version-check": "node ./scripts/tasks/version-check.js"
// 根据 .flowconfig 校验 flow 类型
"flow": "node ./scripts/tasks/flow.js",
// 根据 .eslintrc.js 对 js 做校验
"lint": "node ./scripts/tasks/eslint.js",
// 对有更改的 js 文件进行 eslint 校验
"linc": "git diff --name-only --diff-filter=ACMRTUB `git merge-base HEAD master` | grep '\\.js$' | xargs eslint --",
// 根据 package.json 里 devEngines 字段来校验开发者当前 node|npm 版本环境是否匹配
"postinstall": "node node_modules/fbjs-scripts/node/check-dev-engines.js package.json",
// 校验版本并构建发布 react
"build": "npm run version-check && node scripts/rollup/build.js",
```

* [postinstall](https://docs.npmjs.com/misc/scripts)
* [flow](https://flow.org/en/docs/usage/)

#### scripts/rollup/build.js






