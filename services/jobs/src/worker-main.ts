// Worker entrypoint: `npm run worker` (or the compose `worker` service).
import 'dotenv/config'
import { startWorker } from './worker.ts'

startWorker().catch(e => {
  console.error('worker failed to start:', e)
  process.exit(1)
})
