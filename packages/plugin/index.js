class PostrPlugin {
  constructor({ options, imports }) {
    this.options = options
    this.imports = imports
    this.requireOptions = this.requireOptions.bind(this)
    this.addRxDBPlugin = this.addRxDBPlugin.bind(this)
    this.addRouter = this.addRouter.bind(this)
    this.addUI = this.addUI.bind(this)
    this.requireOptions(['id', 'name'])
  }

  /**
   * Throw error if missing option
   * @param {array} keys Array of required option keys
   */
  requireOptions(keys) {
    keys.forEach(key => {
      if (!this.options.hasOwnProperty(key)) {
        throw new Error(`Missing the ${key} option`)
      }
    })
  }

  /**
   * Adds a RxDB plugin to the Postr instance
   * @param {object} plugin A RxDB plugin
   * @returns {object} An instance of the plugin
   */
  addRxDBPlugin(plugin) {
    this.imports.RxDB.plugin(plugin)
    return this
  }

  /**
   * Adds a express middleware to the Postr instance
   * @param {function} middleware A middleware function
   * @returns {object} An instance of the plugin
   */
  addRouter(middleware) {
    if (this.imports.isNode) {
      this.imports.router.use('/plugin/' + this.options.id, middleware)
    }
    return this
  }

  /**
   * Add a UI component for the plugin
   * @param {*} ui
   */
  addUI(ui) {
    throw new Error(`The plugins UI is not implemented yet.`)
    return this
  }
}

module.exports = PostrPlugin
