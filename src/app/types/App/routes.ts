import { Request, Response, RequestHandler } from 'express';
import App from '../../core/App';

export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';

export abstract class AppRoutes {
  app: App;
  route: string;
  method: HttpMethod;
  middlewares: RequestHandler[];


  constructor(app: App, opts: { route: string; method?: HttpMethod; middlewares?: RequestHandler[]; }) {
    this.app = app;
    this.route = opts.route;
    this.method = (opts.method || 'get') as HttpMethod;
    this.middlewares = opts.middlewares || [];
  }

  abstract handle(req: Request, res: Response): Promise<any>
}
