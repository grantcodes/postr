module.exports = {
  version: 0,
  id: 'post',
  type: 'object',
  properties: {
    type: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    properties: {
      type: 'object',
    },
    indexDate: {
      type: 'integer',
      index: true,
    },
  },
  required: ['type', 'properties', 'indexDate'],
  // disableKeyCompression: true,
  // additionalProperties: true,
}
