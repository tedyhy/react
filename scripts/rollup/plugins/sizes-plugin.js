const gzip = require('gzip-size');

// 计算 bundle 大小
module.exports = function sizes(options) {
  return {
    ongenerate(bundle, obj) {
      const size = Buffer.byteLength(obj.code);
      const gzipSize = gzip.sync(obj.code);

      options.getSize(size, gzipSize);
    },
  };
};
