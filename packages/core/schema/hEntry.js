const hCard = require('./hCard')
const hGeo = require('./hGeo')
const hAdr = require('./hAdr')
const hCite = require('./hCite')
const hItem = require('./hItem')
const hProduct = require('./hProduct')

module.exports = {
  type: 'object',
  properties: {
    value: {
      type: 'string',
    },
    type: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['h-entry'],
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
        summary: {
          type: 'array',
          items: {
            type: 'string',
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
        published: {
          type: 'array',
          items: {
            type: 'string',
            format: 'date-time',
          },
        },
        updated: {
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
              hCard,
            ],
          },
        },
        category: {
          type: 'array',
          items: {
            type: 'string',
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
          },
        },
        location: {
          type: 'array',
          items: {
            oneOf: [
              {
                type: 'string',
              },
              hGeo,
              hAdr,
              hCard,
            ],
          },
        },
        syndication: {
          type: 'array',
          items: {
            type: 'string',
            format: 'uri',
          },
        },
        'in-reply-to': {
          type: 'array',
          items: {
            oneOf: [
              {
                type: 'string',
                format: 'uri',
              },
              // hCite, // TODO: Figure out why this causes validation to break
            ],
          },
        },
        rsvp: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['yes', 'no', 'maybe', 'interested'],
          },
          minItems: 1,
          maxItems: 1,
        },
        'like-of': {
          type: 'array',
          items: {
            type: 'string',
            format: 'uri',
          },
        },
        'repost-of': {
          type: 'array',
          items: {
            type: 'string',
            format: 'uri',
          },
        },
        'bookmark-of': {
          type: 'array',
          items: {
            type: 'string',
            format: 'uri',
          },
        },
        items: {
          type: 'array',
          items: {
            oneOf: [hItem, hProduct],
          },
        },
        photo: {
          type: 'array',
          items: {
            oneOf: [
              {
                type: 'string',
                format: 'uri',
              },
              {
                type: 'object',
                properties: {
                  value: {
                    type: 'string',
                    format: 'uri',
                  },
                  alt: {
                    type: 'string',
                  },
                },
              },
            ],
          },
        },
        video: {
          type: 'array',
          items: {
            type: 'string',
            format: 'uri',
          },
        },
        audio: {
          type: 'array',
          items: {
            type: 'string',
            format: 'uri',
          },
        },
        visibility: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['visible', 'unlisted', 'private'],
          },
          minItems: 1,
          maxItems: 1,
        },
        'post-status': {
          type: 'array',
          items: {
            type: 'string',
            enum: ['draft', 'deleted', 'published'],
          },
          minItems: 1,
          maxItems: 1,
        },
        'mp-slug': {
          type: 'array',
          items: {
            type: 'string',
          },
          // TODO: Maybe format this so no spaces are allowed and only url safe characters
          minItems: 1,
          maxItems: 1,
        },
      },
    },
  },
  required: ['type', 'properties'],
  additionalProperties: true,
}
