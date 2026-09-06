import { createServer } from 'node:net'

/**
 * 空きポートを OS に選ばせる。
 * 固定ポートにするとユーザーが既に起動している OBS の WebSocket と衝突し、
 * こちらの制御要求が相手側の OBS に飛ぶという最悪の事故が起きる。
 */
export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address === null || typeof address === 'string') {
        server.close()
        reject(new Error('空きポートの取得に失敗しました。'))
        return
      }
      const { port } = address
      server.close(() => resolve(port))
    })
  })
}
