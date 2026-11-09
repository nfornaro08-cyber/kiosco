function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compilePath(path) {
  const names = [];
  const segments = path.split('/').filter(Boolean);
  const source = segments
    .map((segment) => {
      if (segment.startsWith(':')) {
        names.push(segment.slice(1));
        return '([^/]+)';
      }
      return escapeRegex(segment);
    })
    .join('/');
  return { regex: new RegExp(`^/${source}/?$`), names };
}

/**
 * Router minimo: recibe una lista de { method, path, handler } y resuelve
 * los parametros de ruta (por ejemplo /api/orders/:id).
 */
export function createRouter(definitions) {
  const routes = definitions.map((route) => ({ ...route, ...compilePath(route.path) }));

  return async function handle(req, res, url) {
    const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;

    for (const route of routes) {
      if (route.method !== req.method) continue;
      const match = route.regex.exec(pathname);
      if (!match) continue;
      const params = Object.fromEntries(route.names.map((name, index) => [name, decodeURIComponent(match[index + 1])]));
      await route.handler(req, res, { params, url });
      return true;
    }

    return false;
  };
}
