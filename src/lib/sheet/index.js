// D&D Beyond sheet import — pure parsing, no Firebase. readPdfFields() is
// the only part that touches pdf.js, and it loads it lazily.
export { readPdfFields, collectWidgetFields } from './readPdfFields'
export { parseDdbSheet, PARSER_VERSION, SKILLS, ABILITY_KEYS, PROFICIENCY_MARKS } from './parseDdbSheet'
export { detectResources } from './resources'
export { diffSheets, summarizeDiff } from './diff'
export { normalizeFieldName, buildFieldMap, spellKey } from './normalize'
export {
  buildImportPlan,
  cleanResources,
  selectDossierFill,
  sheetData,
  SHEET_DOC_BUDGET,
} from './importPlan'
