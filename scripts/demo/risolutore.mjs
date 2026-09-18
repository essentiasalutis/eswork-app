// Solo per gli script: risolve gli import relativi senza estensione ('./livelli')
// come fa Next, così lo script usa ESATTAMENTE il codice della piattaforma.
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { fileURLToPath } from 'node:url';
  export async function resolve(spec, ctx, next) {
    if ((spec.startsWith('./') || spec.startsWith('../')) && !/\\.[cm]?js$/.test(spec) && ctx.parentURL) {
      for (const ext of ['.js', '.mjs', '/index.js']) {
        const u = new URL(spec + ext, ctx.parentURL);
        if (existsSync(fileURLToPath(u))) return next(u.href, ctx);
      }
    }
    return next(spec, ctx);
  }
`));
