require('@babel/register');
require('@babel/polyfill');
const dotenv = require('dotenv');

dotenv.config();
require('./examples-skia.js');
