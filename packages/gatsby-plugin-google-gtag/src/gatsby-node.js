// @ts-check

/**
 * @type {import('gatsby').GatsbyNode["pluginOptionsSchema"]}
 */
exports.pluginOptionsSchema = ({ Joi }) =>
  Joi.object({
    trackingIds: Joi.array()
      .items(Joi.string())
      .description(
        `The tracking IDs; the tracking code won't be generated without them.`
      )
      .required(),
    gtagConfig: Joi.object()
      .keys({
        optimize_id: Joi.string().description(
          `Enable if you need to use Google Optimize.`
        ),
        anonymize_ip: Joi.boolean()
          .description(`Enable if you need to use the "anonymizeIP" function.`)
          .default(false),
      })
      .unknown(true)
      .description(
        `This object gets passed directly to the gtag config command.`
      )
      .default({}),
    pluginConfig: Joi.object()
      .keys({
        head: Joi.boolean()
          .description(
            `Puts tracking script in the <head> instead of the <body>`
          )
          .default(false),
        respectDNT: Joi.boolean()
          .description(
            `If you enable this optional option, Google Global Site Tag will not be loaded at all for visitors that have "Do Not Track" enabled.`
          )
          .default(false),
        exclude: Joi.array()
          .items(Joi.string())
          .description(
            `If you need to exclude any path from the tracking system, you can add it (one or more) to this optional array as glob expressions.`
          )
          .default([]),
        origin: Joi.string()
          .description(`Your optional self hosted origin for the script.`)
          .default(`https://www.googletagmanager.com`),
        delayOnRouteUpdate: Joi.number()
          .description(`Delay processing pageview events on route update`)
          .default(0),
        disabled: Joi.boolean()
          .description(`Prevents the tag to appear`)
          .default(false),
      })
      .description(`Configure the plugin's behavior.`),
  })
