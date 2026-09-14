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

export const DeleteMarkdownSchema = z.object({
  mdPath: MdPathSchema,
  message: z.string().min(1).max(200).optional(),
})

export const RenameMarkdownSchema = z.object({
  oldPath: MdPathSchema,
  newPath: MdPathSchema,
  message: z.string().min(1).max(200).optional(),
})

// 图片路径：允许小写字母/数字/连字符/斜杠/点（文件扩展名）
export const AssetPathSchema = z
  .string()
  .min(1)
  .max(500)
  .regex(/^[a-z0-9\-\/\.]+$/)
  .refine((v) => !v.includes('..') && !v.startsWith('/') && !v.endsWith('/'), {
    message: 'Invalid asset path',
  })

// 往 nav.json 的某个栏目注册一个条目（服务端读-改-写，避免全量 upsertNav 的覆盖风险）
export const RegisterNavItemSchema = z.object({
  categoryId: z.string().min(1).max(100),
  sectionId: z.string().min(1).max(100),
  item: z.object({
    id: z.string().min(1).max(200),
    title: z.string().min(1).max(300),
    type: z.enum(['md', 'link']),
    path: z.string().max(500).optional(),
    url: z.string().max(1000).optional(),
  }),
  message: z.string().min(1).max(200).optional(),
})

// 在某个分类下新建栏目（section）
export const RegisterNavSectionSchema = z.object({
  categoryId: z.string().min(1).max(100),
  section: z.object({
    id: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'section id 只能是小写字母/数字/连字符'),
    title: z.string().min(1).max(200),
  }),
  message: z.string().min(1).max(200).optional(),
})
