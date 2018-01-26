'use strict';

// 加载 rollup 及其插件
const rollup = require('rollup').rollup;
const babel = require('rollup-plugin-babel');
const commonjs = require('rollup-plugin-commonjs');
const alias = require('rollup-plugin-alias');
const uglify = require('rollup-plugin-uglify');
const replace = require('rollup-plugin-replace');
const chalk = require('chalk');
const escapeStringRegexp = require('escape-string-regexp');
const join = require('path').join;
const resolve = require('path').resolve;
const fs = require('fs');
const rimraf = require('rimraf');
const argv = require('minimist')(process.argv.slice(2));
const Modules = require('./modules');
const Bundles = require('./bundles');
const propertyMangleWhitelist = require('./mangle').propertyMangleWhitelist;
const sizes = require('./plugins/sizes-plugin');
const Stats = require('./stats');
const syncReactDom = require('./sync').syncReactDom;
const syncReactNative = require('./sync').syncReactNative;
const Packaging = require('./packaging');
const Header = require('./header');
const closure = require('rollup-plugin-closure-compiler-js');

// bundle 类型定义
const UMD_DEV = Bundles.bundleTypes.UMD_DEV;
const UMD_PROD = Bundles.bundleTypes.UMD_PROD;
const NODE_DEV = Bundles.bundleTypes.NODE_DEV;
const NODE_PROD = Bundles.bundleTypes.NODE_PROD;
const FB_DEV = Bundles.bundleTypes.FB_DEV;
const FB_PROD = Bundles.bundleTypes.FB_PROD;
const RN_DEV = Bundles.bundleTypes.RN_DEV;
const RN_PROD = Bundles.bundleTypes.RN_PROD;

// 获取 React 版本，bundle 类型、名称，及 sync-fbsource、sync-www 参数
const reactVersion = require('../../package.json').version;
const requestedBundleTypes = (argv.type || '')
  .split(',')
  .map(type => type.toUpperCase());
const requestedBundleNames = (argv._[0] || '')
  .split(',')
  .map(type => type.toLowerCase());
const syncFbsource = argv['sync-fbsource'];
const syncWww = argv['sync-www'];

// used for when we property mangle with uglify/gcc
// uglify/gcc 对属性 mangle 的白名单正则表达式
const mangleRegex = new RegExp(
  `^(?${propertyMangleWhitelist
    .map(prop => `!${escapeStringRegexp(prop)}`)
    .join('|')}$).*$`,
  'g'
);

// 根据打包类型获取最终名称或版本号
function getHeaderSanityCheck(bundleType, hasteName) {
  switch (bundleType) {
    case FB_DEV:
    case FB_PROD:
    case RN_DEV:
    case RN_PROD:
      let hasteFinalName = hasteName;
      switch (bundleType) {
        case FB_DEV:
        case RN_DEV:
          hasteFinalName += '-dev';
          break;
        case FB_PROD:
        case RN_PROD:
          hasteFinalName += '-prod';
          break;
      }
      return hasteFinalName;
    case UMD_DEV:
    case UMD_PROD:
      return reactVersion;
    default:
      return null;
  }
}

// 根据打包类型、名称生成最终类库 banner
function getBanner(bundleType, hasteName, filename) {
  switch (bundleType) {
    // UMDs are not wrapped in conditions.
    case UMD_DEV:
    case UMD_PROD:
      return Header.getHeader(filename, reactVersion);
    // CommonJS DEV bundle is guarded to help weak dead code elimination.
    case NODE_DEV:
      let banner = Header.getHeader(filename, reactVersion);
      // Wrap the contents of the if-DEV check with an IIFE.
      // Block-level function definitions can cause problems for strict mode.
      banner += `'use strict';\n\n\nif (process.env.NODE_ENV !== "production") {\n(function() {\n`;
      return banner;
    case NODE_PROD:
      return Header.getHeader(filename, reactVersion);
    // All FB and RN bundles need Haste headers.
    // DEV bundle is guarded to help weak dead code elimination.
    case FB_DEV:
    case FB_PROD:
    case RN_DEV:
    case RN_PROD:
      const isDev = bundleType === FB_DEV || bundleType === RN_DEV;
      const hasteFinalName = hasteName + (isDev ? '-dev' : '-prod');
      // Wrap the contents of the if-DEV check with an IIFE.
      // Block-level function definitions can cause problems for strict mode.
      return (
        Header.getProvidesHeader(hasteFinalName) +
        (isDev ? `\n\n'use strict';\n\n\nif (__DEV__) {\n(function() {\n` : '')
      );
    default:
      throw new Error('Unknown type.');
  }
}

// 根据打包类型生成最终类库 footer
function getFooter(bundleType) {
  // Only need a footer if getBanner() has an opening brace.
  switch (bundleType) {
    // Non-UMD DEV bundles need conditions to help weak dead code elimination.
    case NODE_DEV:
    case FB_DEV:
    case RN_DEV:
      return '\n})();\n}\n';
    default:
      return '';
  }
}

// 根据打包类型更新 BabelConfig
function updateBabelConfig(babelOpts, bundleType) {
  switch (bundleType) {
    case FB_DEV:
    case FB_PROD:
    case RN_DEV:
    case RN_PROD:
      return Object.assign({}, babelOpts, {
        plugins: babelOpts.plugins.concat([
          // Wrap warning() calls in a __DEV__ check so they are stripped from production.
          require('./plugins/wrap-warning-with-env-check'),
        ]),
      });
    case UMD_DEV:
    case UMD_PROD:
    case NODE_DEV:
    case NODE_PROD:
      return Object.assign({}, babelOpts, {
        plugins: babelOpts.plugins.concat([
          // Use object-assign polyfill in open source
          resolve('./scripts/babel/transform-object-assign-require'),

          // Minify invariant messages
          require('../error-codes/replace-invariant-error-codes'),

          // Wrap warning() calls in a __DEV__ check so they are stripped from production.
          require('./plugins/wrap-warning-with-env-check'),
        ]),
      });
    default:
      return babelOpts;
  }
}

// 输出 rollup 警告信息
function handleRollupWarnings(warning) {
  if (warning.code === 'UNRESOLVED_IMPORT') {
    console.error(warning.message);
    process.exit(1);
  }
  console.warn(warning.message || warning);
}

// 更新 BundleConfig
function updateBundleConfig(config, filename, format, bundleType, hasteName) {
  return Object.assign({}, config, {
    banner: getBanner(bundleType, hasteName, filename),
    dest: Packaging.getPackageDestination(config, bundleType, filename),
    footer: getFooter(bundleType),
    format,
    interop: false,
  });
}

// 生成环境变量
function stripEnvVariables(production) {
  return {
    __DEV__: production ? 'false' : 'true',
    'process.env.NODE_ENV': production ? "'production'" : "'development'",
  };
}

// 获取包类型格式名称
function getFormat(bundleType) {
  switch (bundleType) {
    case UMD_DEV:
    case UMD_PROD:
      return `umd`;
    case NODE_DEV:
    case NODE_PROD:
    case FB_DEV:
    case FB_PROD:
    case RN_DEV:
    case RN_PROD:
      return `cjs`;
  }
}

// 根据名称和包类型生成最终包名称
function getFilename(name, hasteName, bundleType) {
  // we do this to replace / to -, for react-dom/server
  name = name.replace('/', '-');
  switch (bundleType) {
    case UMD_DEV:
      return `${name}.development.js`;
    case UMD_PROD:
      return `${name}.production.min.js`;
    case NODE_DEV:
      return `${name}.development.js`;
    case NODE_PROD:
      return `${name}.production.min.js`;
    case FB_DEV:
    case RN_DEV:
      return `${hasteName}-dev.js`;
    case FB_PROD:
    case RN_PROD:
      return `${hasteName}-prod.js`;
  }
}

// uglify 压缩配置
function uglifyConfig(configs) {
  var mangle = configs.mangle;
  var manglePropertiesOnProd = configs.manglePropertiesOnProd;
  var preserveVersionHeader = configs.preserveVersionHeader;
  var removeComments = configs.removeComments;
  var headerSanityCheck = configs.headerSanityCheck;
  return {
    warnings: false,
    compress: {
      screw_ie8: true,
      dead_code: true,
      unused: true,
      drop_debugger: true,
      // we have a string literal <script> that we don't want to evaluate
      // for FB prod bundles (where we disable mangling)
      evaluate: mangle,
      booleans: true,
      // Our www inline transform combined with Jest resetModules is confused
      // in some rare cases unless we keep all requires at the top:
      hoist_funs: mangle,
    },
    output: {
      beautify: !mangle,
      comments(node, comment) {
        if (preserveVersionHeader && comment.pos === 0 && comment.col === 0) {
          // Keep the very first comment (the bundle header) in prod bundles.
          if (
            headerSanityCheck &&
            comment.value.indexOf(headerSanityCheck) === -1
          ) {
            // Sanity check: this doesn't look like the bundle header!
            throw new Error(
              'Expected the first comment to be the file header but got: ' +
                comment.value
            );
          }
          return true;
        }
        return !removeComments;
      },
    },
    mangleProperties: mangle && manglePropertiesOnProd
      ? {
          ignore_quoted: true,
          regex: mangleRegex,
        }
      : false,
    mangle: mangle
      ? {
          toplevel: true,
          screw_ie8: true,
        }
      : false,
  };
}

// 获取 CommonJSConfig 信息
function getCommonJsConfig(bundleType) {
  switch (bundleType) {
    case UMD_DEV:
    case UMD_PROD:
    case NODE_DEV:
    case NODE_PROD:
      return {};
    case RN_DEV:
    case RN_PROD:
      return {
        ignore: Modules.ignoreReactNativeModules(),
      };
    case FB_DEV:
    case FB_PROD:
      // Modules we don't want to inline in the bundle.
      // Force them to stay as require()s in the output.
      return {
        ignore: Modules.ignoreFBModules(),
      };
  }
}

// 获取 rollup config plugins 值
function getPlugins(
  entry,
  babelOpts,
  paths,
  filename,
  bundleType,
  hasteName,
  isRenderer,
  manglePropertiesOnProd,
  useFiber,
  modulesToStub
) {
  const plugins = [
    babel(updateBabelConfig(babelOpts, bundleType)),
    alias(
      Modules.getAliases(paths, bundleType, isRenderer, argv['extract-errors'])
    ),
  ];

  const replaceModules = Modules.getDefaultReplaceModules(
    bundleType,
    modulesToStub
  );

  // We have to do this check because Rollup breaks on empty object.
  // TODO: file an issue with rollup-plugin-replace.
  if (Object.keys(replaceModules).length > 0) {
    plugins.unshift(replace(replaceModules));
  }

  const headerSanityCheck = getHeaderSanityCheck(bundleType, hasteName);

  switch (bundleType) {
    case UMD_DEV:
    case NODE_DEV:
    case FB_DEV:
      plugins.push(
        replace(stripEnvVariables(false)),
        // needs to happen after strip env
        commonjs(getCommonJsConfig(bundleType))
      );
      break;
    case UMD_PROD:
    case NODE_PROD:
      plugins.push(
        replace(stripEnvVariables(true)),
        // needs to happen after strip env
        commonjs(getCommonJsConfig(bundleType)),
        closure({
          compilationLevel: 'SIMPLE',
          languageIn: 'ECMASCRIPT5_STRICT',
          languageOut: 'ECMASCRIPT5_STRICT',
          env: 'CUSTOM',
          warningLevel: 'QUIET',
          assumeFunctionWrapper: true,
          applyInputSourceMaps: false,
          useTypesForOptimization: false,
          processCommonJsModules: false,
        })
      );
      break;
    case FB_PROD:
      plugins.push(
        replace(stripEnvVariables(true)),
        // needs to happen after strip env
        commonjs(getCommonJsConfig(bundleType)),
        uglify(
          uglifyConfig({
            mangle: bundleType !== FB_PROD,
            manglePropertiesOnProd,
            preserveVersionHeader: bundleType === UMD_PROD,
            // leave comments in for source map debugging purposes
            // they will be stripped as part of FB's build process
            removeComments: bundleType !== FB_PROD,
            headerSanityCheck,
          })
        )
      );
      break;
    case RN_DEV:
    case RN_PROD:
      plugins.push(
        replace(stripEnvVariables(bundleType === RN_PROD)),
        // needs to happen after strip env
        commonjs(getCommonJsConfig(bundleType)),
        uglify(
          uglifyConfig({
            mangle: false,
            manglePropertiesOnProd,
            preserveVersionHeader: true,
            removeComments: true,
            headerSanityCheck,
          })
        )
      );
      break;
  }
  // this needs to come last or it doesn't report sizes correctly
  plugins.push(
    sizes({
      getSize: (size, gzip) => {
        const key = `${filename} (${bundleType})`;
        Stats.currentBuildResults.bundleSizes[key] = {
          size,
          gzip,
        };
      },
    })
  );

  return plugins;
}

// 使用 rollup 打包
function createBundle(bundle, bundleType) {
  const shouldSkipBundleType = bundle.bundleTypes.indexOf(bundleType) === -1;
  if (shouldSkipBundleType) {
    return Promise.resolve();
  }
  if (requestedBundleTypes.length > 0) {
    const isAskingForDifferentType = requestedBundleTypes.every(
      requestedType => bundleType.indexOf(requestedType) === -1
    );
    if (isAskingForDifferentType) {
      return Promise.resolve();
    }
  }
  if (requestedBundleNames.length > 0) {
    const isAskingForDifferentNames = requestedBundleNames.every(
      requestedName => bundle.label.indexOf(requestedName) === -1
    );
    if (isAskingForDifferentNames) {
      return Promise.resolve();
    }
  }

  const filename = getFilename(bundle.name, bundle.hasteName, bundleType);
  const logKey =
    chalk.white.bold(filename) + chalk.dim(` (${bundleType.toLowerCase()})`);
  const format = getFormat(bundleType);
  const packageName = Packaging.getPackageName(bundle.name);

  console.log(`${chalk.bgYellow.black(' BUILDING ')} ${logKey}`);
  return rollup({
    entry: bundleType === FB_DEV || bundleType === FB_PROD
      ? bundle.fbEntry
      : bundle.entry,
    external: Modules.getExternalModules(
      bundle.externals,
      bundleType,
      bundle.isRenderer
    ),
    onwarn: handleRollupWarnings,
    plugins: getPlugins(
      bundle.entry,
      bundle.babelOpts,
      bundle.paths,
      filename,
      bundleType,
      bundle.hasteName,
      bundle.isRenderer,
      bundle.manglePropertiesOnProd,
      bundle.useFiber,
      bundle.modulesToStub
    ),
  })
    .then(result =>
      result.write(
        updateBundleConfig(
          bundle.config,
          filename,
          format,
          bundleType,
          bundle.hasteName
        )
      )
    )
    .then(() => Packaging.createNodePackage(bundleType, packageName, filename))
    .then(() => {
      console.log(`${chalk.bgGreen.black(' COMPLETE ')} ${logKey}\n`);
    })
    .catch(error => {
      if (error.code) {
        console.error(`\x1b[31m-- ${error.code} (${error.plugin}) --`);
        console.error(error.message);
        console.error(error.loc);
        console.error(error.codeFrame);
      } else {
        console.error(error);
      }
      process.exit(1);
    });
}

// clear the build directory
// 打包入口，先清理 build 目录
rimraf('build', () => {
  // create a new build directory
  // 创建新的 build 目录
  fs.mkdirSync('build');
  // create the packages folder for NODE+UMD bundles
  // 创建 build/packages 目录用于放置 NODE+UMD bundles
  fs.mkdirSync(join('build', 'packages'));
  // create the dist folder for UMD bundles
  // 创建 build/dist 目录用于放置 UMD bundles
  fs.mkdirSync(join('build', 'dist'));

  // 默认 task
  const tasks = [
    Packaging.createFacebookWWWBuild,
    Packaging.createReactNativeBuild,
  ];
  // 根据打包类型添加多个打包 task
  for (const bundle of Bundles.bundles) {
    tasks.push(
      () => createBundle(bundle, UMD_DEV),
      () => createBundle(bundle, UMD_PROD),
      () => createBundle(bundle, NODE_DEV),
      () => createBundle(bundle, NODE_PROD),
      () => createBundle(bundle, FB_DEV),
      () => createBundle(bundle, FB_PROD),
      () => createBundle(bundle, RN_DEV),
      () => createBundle(bundle, RN_PROD)
    );
  }
  if (syncFbsource) {
    tasks.push(() =>
      syncReactNative(join('build', 'react-native'), syncFbsource)
    );
  } else if (syncWww) {
    tasks.push(() => syncReactDom(join('build', 'facebook-www'), syncWww));
  }
  // rather than run concurently, opt to run them serially
  // this helps improve console/warning/error output
  // and fixes a bunch of IO failures that sometimes occured
  // 异步执行任务队列
  return runWaterfall(tasks)
    .then(() => {
      // output the results
      console.log(Stats.printResults());
      // save the results for next run
      Stats.saveResults();
      if (argv['extract-errors']) {
        console.warn(
          '\nWarning: this build was created with --extract-errors enabled.\n' +
            'this will result in extremely slow builds and should only be\n' +
            'used when the error map needs to be rebuilt.\n'
        );
      }
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
});

function runWaterfall(promiseFactories) {
  if (promiseFactories.length === 0) {
    return Promise.resolve();
  }

  // 取第一个任务
  const head = promiseFactories[0];
  // 取之后所有任务队列
  const tail = promiseFactories.slice(1);

  // 取第一个任务的 promise 对象，如果没有则报错终止任务队列
  const nextPromiseFactory = head;
  const nextPromise = nextPromiseFactory();
  if (!nextPromise || typeof nextPromise.then !== 'function') {
    throw new Error('runWaterfall() received something that is not a Promise.');
  }

  // 递归执行异步任务
  return nextPromise.then(() => {
    return runWaterfall(tail);
  });
}
