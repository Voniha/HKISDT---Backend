import 'express-serve-static-core'

declare module 'express-serve-static-core' {
  interface Request {
    user?: { role: 'admin' | 'user'; [k: string]: any }
  }
}
