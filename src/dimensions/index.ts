// dimensions module — Generate dimensions from intent via generateObject
// Dimension CRUD operations against PGlite

export { generateDimensions, type GenerateDimensionsOptions } from "./generate";

export {
  createDimensions,
  getDimensionsBySession,
  updateDimension,
  deleteDimension,
} from "./crud";
