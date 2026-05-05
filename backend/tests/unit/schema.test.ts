import { describe, expect, it } from "vitest";
import {
  CreateTodoBody,
  UpdateTodoBody,
} from "../../src/validators/todos.schema.js";

describe("CreateTodoBody", () => {
  it("trims and accepts a valid title", () => {
    const r = CreateTodoBody.parse({ title: "   buy milk   " });
    expect(r.title).toBe("buy milk");
  });
  it("rejects empty title", () => {
    expect(() => CreateTodoBody.parse({ title: "" })).toThrow();
  });
  it("rejects whitespace-only title", () => {
    expect(() => CreateTodoBody.parse({ title: "    " })).toThrow();
  });
  it("rejects 201-char title", () => {
    expect(() =>
      CreateTodoBody.parse({ title: "x".repeat(201) })
    ).toThrow();
  });
  it("rejects non-string title", () => {
    expect(() => CreateTodoBody.parse({ title: 123 })).toThrow();
  });
});

describe("UpdateTodoBody", () => {
  it("accepts completed only", () => {
    expect(UpdateTodoBody.parse({ completed: true })).toEqual({
      completed: true,
    });
  });
  it("accepts title only", () => {
    expect(UpdateTodoBody.parse({ title: "x" })).toEqual({ title: "x" });
  });
  it("accepts both", () => {
    expect(UpdateTodoBody.parse({ title: "x", completed: false })).toEqual({
      title: "x",
      completed: false,
    });
  });
  it("rejects empty body", () => {
    expect(() => UpdateTodoBody.parse({})).toThrow();
  });
});
