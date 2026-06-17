import { describe, it, expect } from "vitest";
import { scopedCourseId, scopedAssignmentId } from "../routes/canvas.js";

describe("scopedCourseId", () => {
  it("combines userId and canvas course ID with sentinel", () => {
    expect(scopedCourseId("canvas_42", "101")).toBe("canvas_42__c101");
  });

  it("different users produce different scoped IDs for the same course", () => {
    const alice = scopedCourseId("canvas_1", "99");
    const bob = scopedCourseId("canvas_2", "99");
    expect(alice).not.toBe(bob);
  });

  it("same user with different canvas courses produce different IDs", () => {
    const a = scopedCourseId("canvas_1", "10");
    const b = scopedCourseId("canvas_1", "20");
    expect(a).not.toBe(b);
  });

  it("result is deterministic (same inputs → same output)", () => {
    expect(scopedCourseId("canvas_5", "200")).toBe(scopedCourseId("canvas_5", "200"));
  });
});

describe("scopedAssignmentId", () => {
  it("appends canvas assignment ID to scoped course with sentinel", () => {
    const course = scopedCourseId("canvas_42", "101");
    expect(scopedAssignmentId(course, "999")).toBe("canvas_42__c101__a999");
  });

  it("same canvas assignment under different users never collide", () => {
    const aliceCourse = scopedCourseId("canvas_1", "10");
    const bobCourse = scopedCourseId("canvas_2", "10");
    const aliceAssign = scopedAssignmentId(aliceCourse, "55");
    const bobAssign = scopedAssignmentId(bobCourse, "55");
    expect(aliceAssign).not.toBe(bobAssign);
  });

  it("different assignments in same course produce different IDs", () => {
    const course = scopedCourseId("canvas_1", "10");
    expect(scopedAssignmentId(course, "1")).not.toBe(scopedAssignmentId(course, "2"));
  });

  it("ID embeds both the user and course scopes", () => {
    const id = scopedAssignmentId(scopedCourseId("canvas_7", "42"), "13");
    expect(id).toContain("canvas_7");
    expect(id).toContain("__c42");
    expect(id).toContain("__a13");
  });
});
