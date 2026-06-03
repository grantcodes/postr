import isNode from './is-node.mjs'

let configFile: string = new URL('../config.json', import.meta.url).pathname

const defaults: Record<string, any> = {
  permalinkPattern: ':siteBaseUrl/:year/:month/:day/:slug',
  sendWebmentions: true,
  formatContent: true,
  getRefs: true,
  downloadExternalMedia: true,
  syndication: [],
  mediaDir: new URL('../media', import.meta.url).pathname,
  dbName: 'micropubendpoint',
  dbAdapter: 'default',
  imageSizes: {},
  micropubConfig: {},
}

if (process.env?.MICROPUB_ENDPOINT_CONFIG) {
  configFile = process.env.MICROPUB_ENDPOINT_CONFIG
}

if (isNode && process.argv) {
  const args = process.argv.slice(2)
  for (const arg of args) {
    if (arg.startsWith('--config=')) {
      configFile =
        process.cwd() +
        '/' +
        arg.replace('--config=', '').replace(/'/g, '').replace(/"/g, '')
    }
  }
}

let config: Record<string, any> = Object.assign({}, defaults)

function get(key: string): any {
  return Object.prototype.hasOwnProperty.call(config, key) ? config[key] : null
}

function set(key: string, value: any): void {
  config[key] = value
}

function required(requiredKeys: string[]): void {
  for (const key of requiredKeys) {
    if (!Object.prototype.hasOwnProperty.call(config, key)) {
      throw new Error('Missing required config property: ' + key)
    }
  }
}

export { get, set, required }
