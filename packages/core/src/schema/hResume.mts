import hCard from './hCard.mjs'
import hEvent from './hEvent.mjs'

export default {
  type: 'object',
  properties: {
    value: { type: 'string' },
    type: {
      type: 'array',
      items: { type: 'string', enum: ['h-resume'] },
    },
    properties: {
      type: 'object',
      properties: {
        name: { type: 'array', items: { type: 'string' } },
        summary: {
          type: 'array',
          items: {
            oneOf: [
              { type: 'string' },
              {
                type: 'object',
                properties: {
                  value: { type: 'string' },
                  html: { type: 'string' },
                },
              },
            ],
          },
        },
        contact: {
          type: 'array',
          items: { oneOf: [{ type: 'string' }, hCard] },
        },
        education: { type: 'array', items: hEvent },
        experience: { type: 'array', items: hEvent },
        skill: { type: 'array', items: { type: 'string' } },
        affiliation: { type: 'array', items: hCard },
      },
    },
  },
  required: ['type', 'properties'],
  additionalProperties: true,
}
