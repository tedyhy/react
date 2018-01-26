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
// npm install 后，根据 package.json 里 devEngines 字段来校验开发者当前环境中 node|npm 版本是否匹配
"postinstall": "node node_modules/fbjs-scripts/node/check-dev-engines.js package.json",
// 通过 jest 测试
"test": "jest",
// 校验版本并通过 rollup 构建发布 react
"build": "npm run version-check && node scripts/rollup/build.js",
```

* [postinstall](https://docs.npmjs.com/misc/scripts)
* [flow](https://flow.org/en/docs/usage/)
* [jest](https://facebook.github.io/jest/)

#### scripts/rollup/build.js
1. 创建 build/packages、build/dist、build/facebook-www、build/react-native 目录
2. 生成异步任务队列（队列包括：packaging.js 内、bundles.js 内 bundles），通过 runWaterfall 递归执行异步任务。
```js
const tasks = [
	Packaging.createFacebookWWWBuild,
	Packaging.createReactNativeBuild,
	/******* Isomorphic *******/
	{
		babelOpts: babelOptsReact,
		bundleTypes: [UMD_DEV, UMD_PROD, NODE_DEV, NODE_PROD, FB_DEV, FB_PROD],
		config: {
			destDir: 'build/',
			moduleName: 'React',
			sourceMap: false,
		},
		entry: 'src/isomorphic/ReactEntry',
		externals: [
			'create-react-class/factory',
			'prop-types',
			'prop-types/checkPropTypes',
		],
		fbEntry: 'src/isomorphic/ReactEntry',
		hasteName: 'React',
		isRenderer: false,
		label: 'core',
		manglePropertiesOnProd: false,
		name: 'react',
		paths: [
			'src/isomorphic/**/*.js',

			'src/ReactVersion.js',
			'src/shared/**/*.js',
		],
	},

	/******* React DOM *******/
	{
		babelOpts: babelOptsReact,
		bundleTypes: [UMD_DEV, UMD_PROD, NODE_DEV, NODE_PROD, FB_DEV, FB_PROD],
		config: {
			destDir: 'build/',
			globals: {
				react: 'React',
			},
			moduleName: 'ReactDOM',
			sourceMap: false,
		},
		entry: 'src/renderers/dom/fiber/ReactDOMFiberEntry',
		externals: ['prop-types', 'prop-types/checkPropTypes'],
		fbEntry: 'src/fb/ReactDOMFiberFBEntry',
		hasteName: 'ReactDOMFiber',
		isRenderer: true,
		label: 'dom-fiber',
		manglePropertiesOnProd: false,
		name: 'react-dom',
		paths: [
			'src/renderers/dom/**/*.js',
			'src/renderers/shared/**/*.js',

			'src/ReactVersion.js',
			'src/shared/**/*.js',
		],
	}, {
		babelOpts: babelOptsReact,
		bundleTypes: [FB_DEV, NODE_DEV],
		config: {
			destDir: 'build/',
			globals: {
				react: 'React',
			},
			moduleName: 'ReactTestUtils',
			sourceMap: false,
		},
		entry: 'src/renderers/dom/test/ReactTestUtilsEntry',
		externals: [
			'prop-types',
			'prop-types/checkPropTypes',
			'react',
			'react-dom',
			'react-test-renderer', // TODO (bvaughn) Remove this dependency before 16.0.0
		],
		fbEntry: 'src/renderers/dom/test/ReactTestUtilsEntry',
		hasteName: 'ReactTestUtils',
		isRenderer: true,
		label: 'test-utils',
		manglePropertiesOnProd: false,
		name: 'react-dom/test-utils',
		paths: [
			'src/renderers/dom/test/**/*.js',
			'src/renderers/shared/**/*.js',
			'src/renderers/testing/**/*.js', // TODO (bvaughn) Remove this dependency before 16.0.0

			'src/ReactVersion.js',
			'src/shared/**/*.js',
		],
	},
	/* React DOM internals required for react-native-web (e.g., to shim native events from react-dom) */
	{
		babelOpts: babelOptsReact,
		bundleTypes: [UMD_DEV, UMD_PROD, NODE_DEV, NODE_PROD, FB_DEV, FB_PROD],
		config: {
			destDir: 'build/',
			globals: {
				react: 'React',
				'react-dom': 'ReactDOM',
			},
			moduleName: 'ReactDOMUnstableNativeDependencies',
			sourceMap: false,
		},
		entry: 'src/renderers/dom/shared/ReactDOMUnstableNativeDependenciesEntry',
		externals: [
			'react-dom',
			'ReactDOM',
			'prop-types',
			'prop-types/checkPropTypes',
		],
		fbEntry: 'src/renderers/dom/shared/ReactDOMUnstableNativeDependenciesEntry',
		hasteName: 'ReactDOMUnstableNativeDependencies',
		isRenderer: false,
		label: 'dom-unstable-native-dependencies',
		manglePropertiesOnProd: false,
		name: 'react-dom/unstable-native-dependencies',
		paths: [
			'src/renderers/dom/**/*.js',
			'src/renderers/shared/**/*.js',

			'src/ReactVersion.js',
			'src/shared/**/*.js',
		],
	},

	/******* React DOM Server *******/
	{
		babelOpts: babelOptsReact,
		bundleTypes: [UMD_DEV, UMD_PROD, NODE_DEV, NODE_PROD, FB_DEV, FB_PROD],
		config: {
			destDir: 'build/',
			globals: {
				react: 'React',
			},
			moduleName: 'ReactDOMServer',
			sourceMap: false,
		},
		entry: 'src/renderers/dom/ReactDOMServerBrowserEntry',
		externals: ['prop-types', 'prop-types/checkPropTypes'],
		fbEntry: 'src/renderers/dom/ReactDOMServerBrowserEntry',
		hasteName: 'ReactDOMServer',
		isRenderer: true,
		label: 'dom-server-browser',
		manglePropertiesOnProd: false,
		name: 'react-dom/server.browser',
		paths: [
			'src/renderers/dom/**/*.js',
			'src/renderers/shared/**/*.js',
			'src/ReactVersion.js',
			'src/shared/**/*.js',
		],
	},

	{
		babelOpts: babelOptsReact,
		bundleTypes: [NODE_DEV, NODE_PROD],
		config: {
			destDir: 'build/',
			globals: {
				react: 'React',
			},
			moduleName: 'ReactDOMNodeStream',
			sourceMap: false,
		},
		entry: 'src/renderers/dom/ReactDOMServerNodeEntry',
		externals: ['prop-types', 'prop-types/checkPropTypes', 'stream'],
		isRenderer: true,
		label: 'dom-server-server-node',
		manglePropertiesOnProd: false,
		name: 'react-dom/server.node',
		paths: [
			'src/renderers/dom/**/*.js',
			'src/renderers/shared/**/*.js',
			'src/ReactVersion.js',
			'src/shared/**/*.js',
		],
	},

	/******* React ART *******/
	{
		babelOpts: babelOptsReactART,
		// TODO: we merge react-art repo into this repo so the NODE_DEV and NODE_PROD
		// builds sync up to the building of the package directories
		bundleTypes: [UMD_DEV, UMD_PROD, NODE_DEV, NODE_PROD, FB_DEV, FB_PROD],
		config: {
			destDir: 'build/',
			globals: {
				react: 'React',
			},
			moduleName: 'ReactART',
			sourceMap: false,
		},
		entry: 'src/renderers/art/ReactARTFiberEntry',
		externals: [
			'art/modes/current',
			'art/modes/fast-noSideEffects',
			'art/core/transform',
			'prop-types/checkPropTypes',
			'react-dom',
		],
		fbEntry: 'src/renderers/art/ReactARTFiberEntry',
		hasteName: 'ReactARTFiber',
		isRenderer: true,
		label: 'art-fiber',
		manglePropertiesOnProd: false,
		name: 'react-art',
		paths: [
			'src/renderers/art/**/*.js',
			'src/renderers/shared/**/*.js',

			'src/ReactVersion.js',
			'src/shared/**/*.js',
		],
	},

	/******* React Native *******/
	{
		babelOpts: babelOptsReact,
		bundleTypes: [RN_DEV, RN_PROD],
		config: {
			destDir: 'build/',
			moduleName: 'ReactNativeFiber',
			sourceMap: false,
		},
		entry: 'src/renderers/native/ReactNativeFiberEntry',
		externals: [
			'ExceptionsManager',
			'InitializeCore',
			'Platform',
			'RCTEventEmitter',
			'TextInputState',
			'UIManager',
			'View',
			'deepDiffer',
			'deepFreezeAndThrowOnMutationInDev',
			'flattenStyle',
			'prop-types/checkPropTypes',
		],
		hasteName: 'ReactNativeFiber',
		isRenderer: true,
		label: 'native-fiber',
		manglePropertiesOnProd: false,
		name: 'react-native-renderer',
		paths: [
			'src/renderers/native/**/*.js',
			'src/renderers/shared/**/*.js',

			'src/ReactVersion.js',
			'src/shared/**/*.js',
		],
		useFiber: true,
	},

	/******* React Test Renderer *******/
	{
		babelOpts: babelOptsReact,
		bundleTypes: [FB_DEV, NODE_DEV],
		config: {
			destDir: 'build/',
			moduleName: 'ReactTestRenderer',
			sourceMap: false,
		},
		entry: 'src/renderers/testing/ReactTestRendererFiberEntry',
		externals: ['prop-types/checkPropTypes'],
		fbEntry: 'src/renderers/testing/ReactTestRendererFiberEntry',
		hasteName: 'ReactTestRendererFiber',
		isRenderer: true,
		label: 'test-fiber',
		manglePropertiesOnProd: false,
		name: 'react-test-renderer',
		paths: [
			'src/renderers/native/**/*.js',
			'src/renderers/shared/**/*.js',
			'src/renderers/testing/**/*.js',

			'src/ReactVersion.js',
			'src/shared/**/*.js',
		],
	}, {
		babelOpts: babelOptsReact,
		bundleTypes: [FB_DEV, NODE_DEV],
		config: {
			destDir: 'build/',
			moduleName: 'ReactShallowRenderer',
			sourceMap: false,
		},
		entry: 'src/renderers/testing/ReactShallowRendererEntry',
		externals: [
			'react-dom',
			'prop-types/checkPropTypes',
			'react-test-renderer',
		],
		fbEntry: 'src/renderers/testing/ReactShallowRendererEntry',
		hasteName: 'ReactShallowRenderer',
		isRenderer: true,
		label: 'shallow-renderer',
		manglePropertiesOnProd: false,
		name: 'react-test-renderer/shallow',
		paths: [
			'src/renderers/shared/**/*.js',
			'src/renderers/testing/**/*.js',
			'src/shared/**/*.js',
		],
	},

	/******* React Noop Renderer (used only for fixtures/fiber-debugger) *******/
	{
		babelOpts: babelOptsReact,
		bundleTypes: [NODE_DEV],
		config: {
			destDir: 'build/',
			globals: {
				react: 'React',
			},
			moduleName: 'ReactNoop',
			sourceMap: false,
		},
		entry: 'src/renderers/noop/ReactNoopEntry',
		externals: ['prop-types/checkPropTypes', 'jest-matchers'],
		isRenderer: true,
		label: 'noop-fiber',
		manglePropertiesOnProd: false,
		name: 'react-noop-renderer',
		paths: [
			'src/renderers/noop/**/*.js',
			'src/renderers/shared/**/*.js',

			'src/ReactVersion.js',
			'src/shared/**/*.js',
		],
	},
	syncReactNative(join('build', 'react-native'), syncFbsource),
	syncReactDom(join('build', 'facebook-www'), syncWww),
];
```
3. 生成包
┌──────────────────────────────────────────────────────────────────────┬───────────┬──────────────┬───────┬───────────┬──────────────┬───────┐
│ Bundle                                                               │ Prev Size │ Current Size │ Diff  │ Prev Gzip │ Current Gzip │ Diff  │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ react.development.js (UMD_DEV)                                       │ 62.89 KB  │ 62.92 KB     │ 0 %   │ 16.12 KB  │ 16.12 KB     │ -1 %  │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ react.production.min.js (UMD_PROD)                                   │ 6.44 KB   │ 6.43 KB      │ -1 %  │ 2.69 KB   │ 2.68 KB      │ -1 %  │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ react.development.js (NODE_DEV)                                      │ 54.01 KB  │ 54 KB        │ -1 %  │ 13.93 KB  │ 13.92 KB     │ -1 %  │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ react.production.min.js (NODE_PROD)                                  │ 5.49 KB   │ 5.48 KB      │ -1 %  │ 2.31 KB   │ 2.31 KB      │ -1 %  │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ React-dev.js (FB_DEV)                                                │ 51.32 KB  │ 51.32 KB     │ -1 %  │ 13.17 KB  │ 13.16 KB     │ -1 %  │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ React-prod.js (FB_PROD)                                              │ 24.36 KB  │ 24.35 KB     │ -1 %  │ 6.56 KB   │ 6.55 KB      │ -1 %  │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ react-dom.development.js (UMD_DEV)                                   │ 630.05 KB │ 630.19 KB    │ 0 %   │ 145.04 KB │ 145.08 KB    │ 0 %   │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ react-dom.production.min.js (UMD_PROD)                               │ 100.49 KB │ 100.48 KB    │ -1 %  │ 31.3 KB   │ 31.29 KB     │ -1 %  │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ react-dom.development.js (NODE_DEV)                                  │ 592.37 KB │ 592.53 KB    │ 0 %   │ 136.34 KB │ 136.39 KB    │ 0 %   │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ react-dom.production.min.js (NODE_PROD)                              │ 105.67 KB │ 105.66 KB    │ -1 %  │ 33.1 KB   │ 33.09 KB     │ -1 %  │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ ReactDOMFiber-dev.js (FB_DEV)                                        │ 589.3 KB  │ 589.46 KB    │ 0 %   │ 135.78 KB │ 135.84 KB    │ 0 %   │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ ReactDOMFiber-prod.js (FB_PROD)                                      │ 410.46 KB │ 410.45 KB    │ -1 %  │ 92.07 KB  │ 92.06 KB     │ -1 %  │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ react-dom-test-utils.development.js (NODE_DEV)                       │ 42.1 KB   │ 42.12 KB     │ 0 %   │ 11.15 KB  │ 11.15 KB     │ 0 %   │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ ReactTestUtils-dev.js (FB_DEV)                                       │ 41.67 KB  │ 41.7 KB      │ 0 %   │ 11.08 KB  │ 11.08 KB     │ 0 %   │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ react-dom-unstable-native-dependencies.development.js (UMD_DEV)      │ 85.23 KB  │ 85.25 KB     │ 0 %   │ 21.57 KB  │ 21.57 KB     │ 0 %   │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ react-dom-unstable-native-dependencies.production.min.js (UMD_PROD)  │ 15.05 KB  │ 15.05 KB     │ -1 %  │ 4.95 KB   │ 4.95 KB      │ -1 %  │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ react-dom-unstable-native-dependencies.development.js (NODE_DEV)     │ 79.24 KB  │ 79.24 KB     │ -1 %  │ 19.71 KB  │ 19.71 KB     │ -1 %  │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ react-dom-unstable-native-dependencies.production.min.js (NODE_PROD) │ 13.86 KB  │ 13.85 KB     │ -1 %  │ 4.46 KB   │ 4.45 KB      │ -1 %  │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ ReactDOMUnstableNativeDependencies-dev.js (FB_DEV)                   │ 78.69 KB  │ 78.69 KB     │ 0 %   │ 19.63 KB  │ 19.63 KB     │ 0 %   │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ ReactDOMUnstableNativeDependencies-prod.js (FB_PROD)                 │ 64.29 KB  │ 64.29 KB     │ 0 %   │ 15.32 KB  │ 15.32 KB     │ 0 %   │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ react-dom-server.browser.development.js (UMD_DEV)                    │ 131.4 KB  │ 131.69 KB    │ 0 %   │ 33.64 KB  │ 33.71 KB     │ 0 %   │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ react-dom-server.browser.production.min.js (UMD_PROD)                │ 14.61 KB  │ 14.6 KB      │ -1 %  │ 5.72 KB   │ 5.72 KB      │ -1 %  │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ react-dom-server.browser.development.js (NODE_DEV)                   │ 102.03 KB │ 102.3 KB     │ 0 %   │ 26.69 KB  │ 26.75 KB     │ 0 %   │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ react-dom-server.browser.production.min.js (NODE_PROD)               │ 14.56 KB  │ 14.55 KB     │ -1 %  │ 5.72 KB   │ 5.72 KB      │ -1 %  │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ ReactDOMServer-dev.js (FB_DEV)                                       │ 101.46 KB │ 101.74 KB    │ 0 %   │ 26.6 KB   │ 26.66 KB     │ 0 %   │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ ReactDOMServer-prod.js (FB_PROD)                                     │ 43.04 KB  │ 43.03 KB     │ -1 %  │ 12.04 KB  │ 12.04 KB     │ -1 %  │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ react-dom-server.node.development.js (NODE_DEV)                      │ 104.28 KB │ 104.55 KB    │ 0 %   │ 27.27 KB  │ 27.32 KB     │ 0 %   │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ react-dom-server.node.production.min.js (NODE_PROD)                  │ 15.46 KB  │ 15.45 KB     │ -1 %  │ 6.04 KB   │ 6.04 KB      │ -1 %  │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ react-art.development.js (UMD_DEV)                                   │ 359.53 KB │ 295.39 KB    │ -18 % │ 79.76 KB  │ 64.05 KB     │ -20 % │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ react-art.production.min.js (UMD_PROD)                               │ 80.57 KB  │ 45.4 KB      │ -44 % │ 24.87 KB  │ 14.18 KB     │ -43 % │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ react-art.development.js (NODE_DEV)                                  │ 285.61 KB │ 285.69 KB    │ 0 %   │ 61.09 KB  │ 61.12 KB     │ 0 %   │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ react-art.production.min.js (NODE_PROD)                              │ 51.3 KB   │ 51.3 KB      │ -1 %  │ 16.03 KB  │ 16.02 KB     │ -1 %  │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ ReactARTFiber-dev.js (FB_DEV)                                        │ 284.48 KB │ 284.57 KB    │ 0 %   │ 61.12 KB  │ 61.15 KB     │ 0 %   │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ ReactARTFiber-prod.js (FB_PROD)                                      │ 213.24 KB │ 213.24 KB    │ 0 %   │ 44.37 KB  │ 44.37 KB     │ 0 %   │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ ReactNativeFiber-dev.js (RN_DEV)                                     │ 295.63 KB │ 295.62 KB    │ -1 %  │ 51.45 KB  │ 51.44 KB     │ -1 %  │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ ReactNativeFiber-prod.js (RN_PROD)                                   │ 213.21 KB │ 213.2 KB     │ -1 %  │ 37.05 KB  │ 37.04 KB     │ -1 %  │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ react-test-renderer.development.js (NODE_DEV)                        │ 290.41 KB │ 290.53 KB    │ 0 %   │ 61.66 KB  │ 61.69 KB     │ 0 %   │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ ReactTestRendererFiber-dev.js (FB_DEV)                               │ 289.26 KB │ 289.38 KB    │ 0 %   │ 61.7 KB   │ 61.74 KB     │ 0 %   │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ react-test-renderer-shallow.development.js (NODE_DEV)                │ 9.22 KB   │ 9.22 KB      │ -1 %  │ 2.3 KB    │ 2.3 KB       │ -1 %  │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ ReactShallowRenderer-dev.js (FB_DEV)                                 │ 8.88 KB   │ 8.88 KB      │ 0 %   │ 2.22 KB   │ 2.22 KB      │ 0 %   │
├──────────────────────────────────────────────────────────────────────┼───────────┼──────────────┼───────┼───────────┼──────────────┼───────┤
│ react-noop-renderer.development.js (NODE_DEV)                        │ 277.37 KB │ 277.45 KB    │ 0 %   │ 58.49 KB  │ 58.52 KB     │ 0 %   │
└──────────────────────────────────────────────────────────────────────┴───────────┴──────────────┴───────┴───────────┴──────────────┴───────┘





