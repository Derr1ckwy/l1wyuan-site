import { z } from 'zod'
import { MAX_BODY_CHARS } from './config'

export const MdPathSchema = z
  .string()
  .min(1)
  .max(500)
  .regex(/^[a-z0-9\-\/]+$/i)
  .refine((v) => !v.includes('..') && !v.startsWith('/') && !v.endsWith('/'), {
    message: 'Invalid md path',
  })

export const UpsertNavSchema = z.object({
  navJson: z.string().min(2).max(MAX_BODY_CHARS),
  message: z.string().min(1).max(200).optional(),
})

export const UpsertMarkdownSchema = z.object({
  mdPath: MdPathSchema,
  markdown: z.string().min(0).max(MAX_BODY_CHARS),
  message: z.string().min(1).max(200).optional(),
})
