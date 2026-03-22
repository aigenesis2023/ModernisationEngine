import type { CourseIR, BrandProfile } from '../ir/types';

// Stub — enhanced in Chunk 3
export async function transformCourse(course: CourseIR, brand: BrandProfile): Promise<CourseIR> {
  // Passthrough for now — enrichment added later
  return course;
}
