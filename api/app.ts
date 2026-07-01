/**
 * Express 应用入口 — Vercel Serverless 版本
 */
import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import voiceRoutes from './routes/voices.js'
import cloneRoutes from './routes/clone.js'
import convertRoutes from './routes/convert.js'
import ttsRoutes from './routes/tts.js'
import outputRoutes from './routes/output.js'
import { seedPresets } from './services/voiceService.js'
import { getProviderStatus } from './services/aiProvider.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/** API 路由 */
app.use('/api/voices', voiceRoutes)
app.use('/api/clone', cloneRoutes)
app.use('/api/convert', convertRoutes)
app.use('/api/tts', ttsRoutes)
app.use('/api/output', outputRoutes)

/** 健康检查 */
app.use('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({ success: true, message: 'ok' })
})

/** AI Provider 状态 — 供前端显示当前引擎 */
app.use('/api/provider', (_req: Request, res: Response) => {
  res.status(200).json({ success: true, data: getProviderStatus() })
})

/** 错误处理 */
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[api error]', err.message)
  res.status(500).json({ success: false, error: err.message || 'Server internal error' })
})

// ============================================================
//  生产环境: 托管前端构建产物 (dist/)
// ============================================================

const distPath = path.join(__dirname, '..', 'dist')
if (fs.existsSync(distPath)) {
  // 静态文件
  app.use(express.static(distPath))

  // SPA 路由 fallback — 所有非 API 请求返回 index.html
  app.get('*', (req: Request, res: Response) => {
    // 排除 API 和已处理的静态路径
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/') || req.path.startsWith('/outputs/')) {
      return res.status(404).json({ success: false, error: 'Not found' })
    }
    res.sendFile(path.join(distPath, 'index.html'))
  })
} else {
  // 开发模式: 未构建前端
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ success: false, error: 'API not found (dev mode: run vite separately)' })
  })
}

// 启动时确保预设音色就绪
seedPresets()

export default app
