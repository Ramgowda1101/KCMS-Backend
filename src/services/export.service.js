// src/services/export.service.js
const { Parser } = require("json2csv");

/**
 * Convert JSON data into CSV string.
 * @param {Array} data - Array of objects to export
 * @param {string} filename - (optional) filename
 * @returns {string} CSV content
 */
exports.exportToCSV = async (data, filename = "export.csv") => {
  const parser = new Parser();
  const csv = parser.parse(data);
  return csv;
};
