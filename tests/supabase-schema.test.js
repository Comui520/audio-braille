import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const schema = readFileSync(resolve(process.cwd(), 'supabase/experiment-schema.sql'), 'utf8').toLowerCase()
const tables = ['experiment_sessions', 'experiment_trials', 'reader_trials', 'upload_receipts']

describe('Supabase 实验数据 schema 安全边界', () => {
  it('为所有实验表启用 RLS', () => {
    for (const table of tables) {
      expect(schema).toContain(`alter table public.${table} enable row level security`)
    }
  })

  it('不向 anon/authenticated 暴露实验数据表，并保留服务端写入权限', () => {
    for (const table of tables) {
      expect(schema).toContain(`revoke all on table public.${table} from public, anon, authenticated`)
      expect(schema).toContain(`grant select, insert, update, delete on table public.${table} to service_role`)
    }
  })
})
