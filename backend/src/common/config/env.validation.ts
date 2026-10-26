import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3001),
  HOST: Joi.string().default('::'),
  PHIMAPI_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('https://phimapi.com')
    .when('NODE_ENV', {
      is: 'production',
      // oxlint-disable-next-line unicorn/no-thenable -- Joi's conditional keyword
      then: Joi.string().uri({ scheme: ['https'] }).required(),
    }),
  CORS_ORIGINS: Joi.string().default('http://localhost:5173,http://localhost:4173'),
  CACHE_MAX_ENTRIES: Joi.number().integer().min(1).default(500),
  CACHE_TTL_LIST_MS: Joi.number().integer().min(1000).default(240000),
  CACHE_TTL_NEW_MS: Joi.number().integer().min(1000).default(120000),
  CACHE_TTL_SEARCH_MS: Joi.number().integer().min(1000).default(60000),
  CACHE_TTL_DETAIL_MS: Joi.number().integer().min(1000).default(360000),
  UPSTREAM_TIMEOUT_MS: Joi.number().integer().min(100).max(9000).default(5000),
  UPSTREAM_RETRIES: Joi.number().integer().min(0).max(3).default(1),
  UPSTREAM_TOTAL_TIMEOUT_MS: Joi.number().integer().min(500).max(9500).default(9000),
  UPSTREAM_MAX_BYTES: Joi.number().integer().min(1024).default(2000000),
  RATE_LIMIT_TTL_MS: Joi.number().integer().min(1000).default(60000),
  RATE_LIMIT_LIMIT: Joi.number().integer().min(1).default(120),
  CATALOG_INDEX_PATH: Joi.string().default('data/catalog-index.json'),
  CATALOG_INDEX_CONCURRENCY: Joi.number().integer().min(1).max(32).default(8),
  TRUST_PROXY: Joi.boolean().default(false),
  SWAGGER_ENABLED: Joi.boolean().optional(),
}).unknown(true);
