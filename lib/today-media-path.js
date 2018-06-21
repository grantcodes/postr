const moment = require('moment')
const config = require('./config')

module.exports = () => moment().format('YYYY/MM/DD')
