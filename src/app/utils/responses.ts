
import { Response } from 'express';

export const success = (res: Response, message: string = 'Success', status = 500, data: any = null) => {
  return res.status(status).json({ message, data: data });
}

export const error = (res: Response, message = 'Error', status = 500, data: any = null) => {
  return res.status(status).json({ error: { message, data: data } });
}
