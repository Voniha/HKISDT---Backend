import { AppRoutes } from '../../types/App/routes';
import { Request, Response } from 'express';
import { success } from '../../utils/responses';
import App from '../../core/App';

export default class UsersRoute extends AppRoutes {
  constructor(app: App) {
    super(app, {
      route: '/api/users',
      method: 'get',
      middlewares: [],
    })
  }
  async handle(req: Request, res: Response) {
    const vijesti = await this.app.db.select(['vijesti']);
    success(res, 'Users fetched successfully', 200, vijesti.vijesti)
  }
}
