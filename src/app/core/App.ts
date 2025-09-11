import express, { Application, RequestHandler, Request, Response } from 'express';
import { json, urlencoded } from 'body-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { AppRoutes } from '../types/App/routes';
import Logger from '../utils/logger';
import Database from './Database';

export class App {
  public express: Application;
  public port: number | string;
  public logger: Logger;
  public db: Database = new Database();

  constructor(port: number | string = process.env.PORT || 3000) {
    this.express = express();
    this.port = port;
    this.logger = new Logger('info', 'App');
    this.setupMiddlewares();
    this.registerHealthRoute();
    this.loadDynamicRoutes();
  }

  private setupMiddlewares(): void {
    this.express.use(helmet())
    this.express.use(cors())
    this.express.use(morgan('dev'))
    this.express.use(compression())
    this.express.use(json())
    this.express.use(urlencoded({ extended: false }))
    this.express.use(multer().any())
  }

  private registerHealthRoute(): void {
    this.express.get('/health', (_req: Request, res: Response) => res.status(200).json({ status: 'ok' }))
  }

  private loadDynamicRoutes(): void {
    const routesPath = path.join(__dirname, '..', 'routes');
    fs.readdirSync(routesPath).forEach((file) => {
      if (fs.lstatSync(path.join(routesPath, file)).isDirectory()) {
        fs.readdirSync(path.join(routesPath, file)).forEach((subFile) => {
          if (subFile.endsWith('.ts') || subFile.endsWith('.js')) {
            import(path.join(routesPath, file, subFile)).then((module) => {
              const route: AppRoutes = new module.default(this);
              this.express[route.method](route.route, ...(route.middlewares as RequestHandler[]), route.handle.bind(route));
              this.logger.info(`Registered route [${route.method.toUpperCase()}] ${route.route}`);
            });
          }
        });
      } else if (file.endsWith('.ts') || file.endsWith('.js')) {
        import(path.join(routesPath, file)).then((module) => {
          const route: AppRoutes = new module.default(this);
          this.express[route.method](route.route, ...(route.middlewares as RequestHandler[]), route.handle.bind(route));
          this.logger.info(`Registered route [${route.method.toUpperCase()}] ${route.route}`);
        });
      }
    });
  }

  public listen(): void {
    this.express.listen(this.port, () => this.logger.info(`Server listening on port ${this.port}`))
  }
}

export default App
