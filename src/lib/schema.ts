import { z } from 'zod';

export const DrawerItemSchema = z.object({
  id: z.string(),
  selectedText: z.string(),
  question: z.string(),
  site: z.enum(['claude', 'chatgpt']),
  createdAt: z.number(),
});

export type DrawerItem = z.infer<typeof DrawerItemSchema>;

export const DrawerStateSchema = z.object({
  items: z.array(DrawerItemSchema),
});

export type DrawerState = z.infer<typeof DrawerStateSchema>;
