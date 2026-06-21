import { Injectable, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

export interface RouteEntry {
  method: string;
  path: string;
  auth: 'public' | 'jwt' | 'api-key';
  module: string;
}

const METHODS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
] as const;

@Injectable()
export class RoutesService implements OnModuleInit {
  private routes: RouteEntry[] = [];

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  onModuleInit(): void {
    this.routes = this.discoverRoutes();
  }

  getAll(): RouteEntry[] {
    return this.routes;
  }

  getGrouped(): Record<string, RouteEntry[]> {
    return this.routes.reduce<Record<string, RouteEntry[]>>((acc, route) => {
      const key = route.module;
      if (!acc[key]) acc[key] = [];
      acc[key].push(route);
      return acc;
    }, {});
  }

  private discoverRoutes(): RouteEntry[] {
    const expressApp = this.adapterHost.httpAdapter.getInstance();
    const stack: Array<{
      route?: { path: string; methods: Record<string, boolean> };
      name?: string;
      handle?: { stack?: unknown[] };
      regexp?: RegExp;
      keys?: Array<{ name: string }>;
    }> = expressApp?._router?.stack ?? [];

    const entries: RouteEntry[] = [];

    const walk = (layers: typeof stack, prefix = '') => {
      for (const layer of layers) {
        if (layer.route) {
          const rawPath = `${prefix}${layer.route.path}`.replace(/\/+/g, '/');
          const path = rawPath.startsWith('/api') ? rawPath : `/api${rawPath}`;
          for (const method of METHODS) {
            if (layer.route.methods[method]) {
              entries.push({
                method: method.toUpperCase(),
                path,
                auth: this.inferAuth(path, method),
                module: this.inferModule(path),
              });
            }
          }
        } else if (layer.name === 'router' && layer.handle?.stack) {
          const match = layer.regexp?.source
            .replace('\\/?', '')
            .replace('(?=\\/|$)', '')
            .replace(/\\\//g, '/')
            .replace(/\^/, '')
            .replace(/\$.*/, '');
          let segment = '';
          if (layer.keys?.length) {
            segment = `/:${layer.keys.map((k) => k.name).join('/:')}`;
          } else if (match && match !== '') {
            segment = match.replace(/\\\./g, '.');
          }
          walk(layer.handle.stack as typeof stack, `${prefix}${segment}`);
        }
      }
    };

    walk(stack);
    return entries.sort(
      (a, b) =>
        a.module.localeCompare(b.module) ||
        a.path.localeCompare(b.path) ||
        a.method.localeCompare(b.method),
    );
  }

  private inferModule(path: string): string {
    const segment = path.replace(/^\/api\/?/, '').split('/')[0] || 'root';
    return segment;
  }

  private inferAuth(path: string, method: string): RouteEntry['auth'] {
    if (path.startsWith('/api/partner')) return 'api-key';
    const publicPaths = [
      '/api/health',
      '/api/routes',
      '/api/auth/register',
      '/api/auth/verify-otp',
      '/api/auth/login',
      '/api/auth/refresh',
      '/api/auth/google',
      '/api/auth/forgot-password',
      '/api/auth/reset-password',
      '/api/catalog',
      '/api/certificates/verify',
    ];
    if (publicPaths.some((p) => path === p || path.startsWith(p + '/'))) {
      if (path.startsWith('/api/catalog/') && method !== 'get') return 'jwt';
      if (path.startsWith('/api/users/') && method === 'get') return 'public';
      if (path.startsWith('/api/organizations/slug/')) return 'public';
      if (path.startsWith('/api/certificates/verify/')) return 'public';
      if (path.startsWith('/api/auth/google')) return 'public';
      return 'public';
    }
    return 'jwt';
  }
}
