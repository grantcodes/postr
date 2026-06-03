class PostrPlugin {
  options: PostrPlugin.Options
  imports: PostrPlugin.Imports

  constructor({ options, imports }: { options: PostrPlugin.Options; imports: PostrPlugin.Imports }) {
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
   */
  requireOptions(keys: string[]): void {
    keys.forEach((key: string) => {
      if (!this.options.hasOwnProperty(key)) {
        throw new Error(`Missing the ${key} option`)
      }
    })
  }

  /**
   * Adds a RxDB plugin to the Postr instance
   */
  addRxDBPlugin(plugin: any): this {
    this.imports.RxDB.plugin(plugin)
    return this
  }

  /**
   * Adds an Express middleware to the Postr instance
   */
  addRouter(middleware: any): this {
    if (this.imports.isNode) {
      this.imports.router.use('/plugin/' + this.options.id, middleware)
    }
    return this
  }

  /**
   * Add a UI component for the plugin (not yet implemented)
   */
  addUI(_ui: any): this {
    throw new Error('The plugins UI is not implemented yet.')
  }
}

namespace PostrPlugin {
  /**
   * Plugin imports contract — the shape of the object passed
   * to every plugin constructor by the Postr runtime.
   */
  export interface Imports {
    RxDB: any
    config: any
    getCollection: any
    generateSearch: any
    router: any
    getHEntry: any
    isNode: boolean
  }

  /**
   * Plugin options contract — open-ended per-plugin options bag.
   * Every plugin must provide `id` and `name` at minimum.
   */
  export interface Options {
    id: string
    name: string
    [key: string]: any
  }
}

export { PostrPlugin }
