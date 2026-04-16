import { describe, it, expect } from "vitest";
import {
  deleteRubricLevel,
  addRubricLevel,
} from "@/dimensions/rubric-helpers";

describe("deleteRubricLevel", () => {
  it("removes the specified level and reindexes remaining levels", () => {
    const rubric = { "1": "Bad", "2": "OK", "3": "Good" };
    const result = deleteRubricLevel(rubric, null, "2");
    expect(result.rubric).toEqual({ "1": "Bad", "2": "Good" });
  });

  it("reindexes examples when removing a level", () => {
    const rubric = { "1": "Bad", "2": "OK", "3": "Good" };
    const examples = { "1": "ex1", "2": "ex2", "3": "ex3" };
    const result = deleteRubricLevel(rubric, examples, "2");
    expect(result.rubric).toEqual({ "1": "Bad", "2": "Good" });
    expect(result.examples).toEqual({ "1": "ex1", "2": "ex3" });
  });

  it("returns null examples when all examples are removed", () => {
    const rubric = { "1": "Bad", "2": "OK", "3": "Good" };
    const examples = { "2": "ex2" };
    const result = deleteRubricLevel(rubric, examples, "2");
    expect(result.rubric).toEqual({ "1": "Bad", "2": "Good" });
    expect(result.examples).toBeNull();
  });

  it("handles null examples input", () => {
    const rubric = { "1": "Bad", "2": "OK", "3": "Good" };
    const result = deleteRubricLevel(rubric, null, "1");
    expect(result.rubric).toEqual({ "1": "OK", "2": "Good" });
    expect(result.examples).toBeNull();
  });

  it("removes the first level correctly", () => {
    const rubric = { "1": "Bad", "2": "OK", "3": "Good" };
    const examples = { "1": "ex1", "3": "ex3" };
    const result = deleteRubricLevel(rubric, examples, "1");
    expect(result.rubric).toEqual({ "1": "OK", "2": "Good" });
    expect(result.examples).toEqual({ "2": "ex3" });
  });

  it("removes the last level correctly", () => {
    const rubric = { "1": "Bad", "2": "OK", "3": "Good" };
    const examples = { "1": "ex1", "2": "ex2", "3": "ex3" };
    const result = deleteRubricLevel(rubric, examples, "3");
    expect(result.rubric).toEqual({ "1": "Bad", "2": "OK" });
    expect(result.examples).toEqual({ "1": "ex1", "2": "ex2" });
  });
});

describe("addRubricLevel", () => {
  it("adds a new level at the end", () => {
    const rubric = { "1": "Bad", "2": "OK", "3": "Good" };
    const result = addRubricLevel(rubric);
    expect(result).toEqual({
      "1": "Bad",
      "2": "OK",
      "3": "Good",
      "4": "Level 4 description",
    });
  });

  it("works with a single existing level", () => {
    const rubric = { "1": "Only level" };
    const result = addRubricLevel(rubric);
    expect(result).toEqual({
      "1": "Only level",
      "2": "Level 2 description",
    });
  });

  it("works with empty rubric", () => {
    const rubric = {};
    const result = addRubricLevel(rubric);
    expect(result).toEqual({ "1": "Level 1 description" });
  });
});
