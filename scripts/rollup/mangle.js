'use strict';

// these are added as they are handled by rollup in some cases
// uglify.js mangle property whitelist
const propertyMangleWhitelist = [
  // React
  'React',
  'ReactDOM',
];

module.exports = {
  propertyMangleWhitelist,
};
