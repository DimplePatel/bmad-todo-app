import { z } from "zod";
import { TODO_TITLE_MAX } from "@todo/shared";

export const TitleSchema = z
  .string({ required_error: "title is required", invalid_type_error: "title must be a string" })
  .transform((s) => s.trim())
  .pipe(z.string().min(1, "title cannot be empty").max(TODO_TITLE_MAX, `title cannot exceed ${TODO_TITLE_MAX} characters`));

export const CreateTodoBody = z.object({
  title: TitleSchema,
});

export const UpdateTodoBody = z
  .object({
    title: TitleSchema.optional(),
    completed: z.boolean().optional(),
  })
  .refine((v) => v.title !== undefined || v.completed !== undefined, {
    message: "At least one of title or completed is required",
  });

export const IdParam = z.object({
  id: z.string().uuid("id must be a UUID"),
});

export const BulkDeleteQuery = z.object({
  completed: z.literal("true", {
    errorMap: () => ({
      message: "completed=true is required for bulk delete",
    }),
  }),
});
