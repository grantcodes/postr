const hCite = require('./hCite')

module.export = {
  type: 'object',
  properties: {
    value: {
      type: 'string',
    },
    type: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['h-cite'],
      },
    },
    properties: {
      type: 'object',
      properties: {
        name: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        published: {
          type: 'array',
          items: {
            type: 'string',
            format: 'date-time',
          },
        },
        author: {
          type: 'array',
          items: {
            oneOf: [
              {
                type: 'string',
              },
              hCite,
            ],
          },
        },
        url: {
          type: 'array',
          items: {
            type: 'string',
            format: 'uri',
          },
        },
        uid: {
          type: 'array',
          items: {
            type: 'string',
            format: 'uri',
          },
        },
        publication: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        accessed: {
          type: 'array',
          items: {
            type: 'string',
            format: 'date-time',
          },
        },
        content: {
          type: 'array',
          items: {
            oneOf: [
              {
                type: 'string',
              },
              {
                type: 'object',
                properties: {
                  value: {
                    type: 'string',
                  },
                  html: {
                    type: 'string',
                  },
                },
              },
            ],
          },
        },
      },
    },
  },
  required: ['type', 'properties'],
  additionalProperties: true,
}
