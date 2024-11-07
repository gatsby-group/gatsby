import path from 'path';
import openurl from 'better-opn';
import fs from 'fs-extra';
import compression from 'compression';
import express from 'express';
import chalk from 'chalk';
import { match as reachMatch } from '@gatsbyjs/reach-router';
import report from 'gatsby-cli/lib/reporter';

import { detectPortInUseAndPrompt } from '../utils/detect-port-in-use-and-prompt';
import { getConfigFile } from '../bootstrap/get-config-file';
import { preferDefault } from '../bootstrap/prefer-default';
import { IProgram } from './types';
import { IPreparedUrls, prepareUrls } from '../utils/prepare-urls';
import { IGatsbyConfig, IGatsbyFunction, IGatsbyPage, IGatsbyState } from '../redux/types';
import { reverseFixedPagePath } from '../utils/page-data';
import { initTracer } from '../utils/tracer';
import { configureTrailingSlash } from '../utils/express-middlewares';
import { getDataStore } from '../datastore';
import { functionMiddlewares } from '../internal-plugins/functions/middleware';
import { thirdPartyProxyPath, partytownProxy } from '../internal-plugins/partytown/proxy';
import { slash } from 'gatsby-core-utils/path';

interface IMatchPath {
  path: string;
  matchPath: string;
}

interface IServeProgram extends IProgram {
  prefixPaths: boolean;
}

interface IMatchPathMiddlewareOptions {
  root: string;
  enableLogging?: boolean;
}

const readMatchPaths = async (program: IServeProgram): Promise<Array<IMatchPath>> => {
  const filePath = path.join(program.directory, '.cache', 'match-paths.json');
  try {
    const rawJSON = await fs.readFile(filePath, 'utf8');
    return JSON.parse(rawJSON) as Array<IMatchPath>;
  } catch (error) {
    report.warn(`Could not read ${chalk.bold('match-paths.json')} from the .cache directory`);
    report.warn(`Client-side routing may not work correctly. Try re-running ${chalk.bold('gatsby build')}.`);
    return [];
  }
};

const sanitizeUrl = (url: string): string => {
  try {
    let decodedUrl = url;
    let previousUrl;

    do {
      previousUrl = decodedUrl;
      decodedUrl = decodeURIComponent(decodedUrl);
    } while (previousUrl !== decodedUrl);

    decodedUrl = decodedUrl.split(/[?#]/)[0];
    decodedUrl = decodedUrl.replace(/\/{2,}/g, '/');
    decodedUrl = decodedUrl.startsWith('/') ? decodedUrl : `/${decodedUrl}`;
    decodedUrl = decodedUrl !== '/' ? decodedUrl.replace(/\/$/, '') : decodedUrl;
    decodedUrl = decodedUrl.replace(/(^|\/)\.\.?(\/|$)/g, '/');
    decodedUrl = decodedUrl.replace(/[^a-zA-Z0-9\-._~!$&'()*+,;=:@/]/g, '');

    return decodedUrl || '/';
  } catch (e) {
    report.warn(`Failed to sanitize URL: "${url}". Error: ${e.message}`);
    return url;
  }
};

const createMatchPathMiddleware = (
  matchPaths: Array<IMatchPath>,
  options: IMatchPathMiddlewareOptions
): express.RequestHandler => {
  const pathCache = new Map<string, string | null>();
  const { root, enableLogging = false } = options;

  const getCachedPath = (url: string) => pathCache.get(url);
  const cachePath = (url: string, resolvedPath: string | null) => {
    pathCache.set(url, resolvedPath);
  };

  return (req, res, next) => {
    if (!req.accepts('html')) return next();

    const originalUrl = req.url;
    const cachedPath = getCachedPath(originalUrl);

    if (cachedPath !== undefined) {
      return cachedPath
        ? res.sendFile(path.join(cachedPath, 'index.html'), { root })
        : next();
    }

    const sanitizedUrl = sanitizeUrl(originalUrl);
    const startTime = enableLogging ? process.hrtime() : null;

    try {
      const matchPath = findMatchPath(matchPaths, sanitizedUrl);

      if (matchPath) {
        cachePath(originalUrl, matchPath.path);
        logMatch(originalUrl, matchPath.path, startTime, enableLogging);

        return res.sendFile(
          path.join(matchPath.path, 'index.html'),
          { root },
          (err: Error) => {
            if (err) {
              cachePath(originalUrl, null);
              res.status(404).end();
            }
          }
        );
      }

      cachePath(originalUrl, null);
      next();
    } catch (error) {
      handleError(originalUrl, error, res, next);
    }
  };
};

const findMatchPath = (matchPaths: Array<IMatchPath>, url: string): IMatchPath | undefined => {
  return matchPaths.find(({ matchPath }) => {
    try {
      return reachMatch(matchPath, url) !== null;
    } catch (e) {
      report.error(`Error matching path for ${matchPath}: ${e.message}`);
      return false;
    }
  });
};

const logMatch = (
  url: string,
  matchedPath: string,
  startTime: [number, number] | null,
  enableLogging: boolean
) => {
  if (enableLogging && startTime) {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds * 1000 + nanoseconds / 1e6;
    report.info(`Matched ${url} to ${matchedPath} in ${duration.toFixed(2)}ms`);
  }
};

const handleError = (
  url: string,
  error: Error,
  res: express.Response,
  next: express.NextFunction
) => {
  report.error(`Error processing URL "${url}": ${error.message}`);
  res.status(500);
  next(error);
};

module.exports = async (program: IServeProgram): Promise<void> => {
  await initTracer(process.env.GATSBY_OPEN_TRACING_CONFIG_FILE || program.openTracingConfigFile);
  let { prefixPaths, port, open, host } = program;
  port = typeof port === 'string' ? parseInt(port, 10) : port;

  const { configModule } = await getConfigFile(program.directory, 'gatsby-config');
  const config: IGatsbyConfig = preferDefault(configModule);

  const { pathPrefix: configPathPrefix, trailingSlash } = config || {};
  const pathPrefix = prefixPaths && configPathPrefix ? configPathPrefix : '/';
  const root = path.join(program.directory, 'public');

  const app = express();
  const { partytownProxiedURLs = [] } = config || {};

  app.use(thirdPartyProxyPath, partytownProxy(partytownProxiedURLs));

  const router = express.Router();
  router.use(compression());
  router.use(
    configureTrailingSlash(
      () =>
        ({
          pages: {
            get(pathName: string): IGatsbyPage | undefined {
              return getDataStore().getNode(`SitePage ${pathName}`) as IGatsbyPage | undefined;
            },
            values(): Iterable<IGatsbyPage> {
              return getDataStore().iterateNodesByType('SitePage') as Iterable<IGatsbyPage>;
            },
          },
        } as unknown as IGatsbyState),
      trailingSlash
    )
  );

  router.use(express.static('public', { dotfiles: 'allow' }));

  const matchPaths = await readMatchPaths(program);
  router.use(
    createMatchPathMiddleware(matchPaths, {
      root,
      enableLogging: process.env.NODE_ENV !== 'production',
    })
  );

  router.use((req, res, next) => {
    if (req.accepts('html')) {
      return res.status(404).sendFile('404.html', { root });
    }
    return next();
  });

  app.use(pathPrefix, router);

  const startListening = (): void => {
    app.listen(port, host, () => {
      const urls = prepareUrls(program.ssl ? 'https' : 'http', program.host, port);
      printInstructions(program.sitePackageJson.name || '(Unnamed package)', urls);
      if (open) {
        report.info('Opening browser...');
        Promise.resolve(openurl(urls.localUrlForBrowser)).catch(() =>
          report.warn('Browser not opened because no browser was found')
        );
      }
    });
  };

  try {
    port = await detectPortInUseAndPrompt(port, program.host);
    startListening();
  } catch (e) {
    if (e.message === 'USER_REJECTED') {
      return;
    }
    throw e;
  }
};
