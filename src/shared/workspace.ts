import { z } from "zod";
export const entrySchema = z
  .object({
    kind: z.enum(["agenda", "task", "resource"]),
    title: z.string().trim().min(1).max(120),
    detail: z.string().trim().max(500).default(""),
    url: z
      .string()
      .max(2000)
      .url()
      .refine((v) => /^https?:\/\//i.test(v))
      .optional(),
    startsAt: z.iso.datetime().optional(),
  })
  .refine((v) => v.kind !== "agenda" || !!v.startsAt)
  .refine((v) => v.kind !== "resource" || !!v.url);
export interface WorkspaceEntry {
  id: string;
  kind: "agenda" | "task" | "resource" | "file";
  title: string;
  detail: string;
  url: string | null;
  startsAt: string | null;
  completed: boolean;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  fileSize: number | null;
}
