const fs = require('node:fs');
const path = require('node:path');
const ExcelJS = require('exceljs');
const { CATEGORY_NAMES, scoreLetterBodyExperimental } = require('../services/experimentalLetterBodyScoring');

const EXPECTED_RECORDS = 162;
const DATASET_PATH = path.resolve(__dirname, '../../Real_Letters_Body_Scores_75pts_Combined current.xlsx');
const REPORT_PATH = path.resolve(__dirname, '../reports/experimental-letter-body-scoring-validation.json');

const BASELINE = {
    categories: {
        'Paragraph Structure': { exactMatchPct: 0.6, mae: 3.23, predictedAverage: 15, humanAverage: 11.77 },
        'Academic Update': { exactMatchPct: 6.8, mae: 5.28, predictedAverage: 13.61, humanAverage: 8.57 },
        'Self-Improvement': { exactMatchPct: 6.2, mae: 3.49, predictedAverage: 9.88, humanAverage: 8.24 },
        'Family Update': { exactMatchPct: 3.7, mae: 6.49, predictedAverage: 11.57, humanAverage: 5.34 },
        'Difficulty Update': { exactMatchPct: 11.7, mae: 3.98, predictedAverage: 6.54, humanAverage: 7.16 },
    },
    overall: {
        exactMatchPct: 1.2,
        mae: 16.43,
        predictedAverage: 56.6,
        humanAverage: 41.09,
    },
};

function cellValue(cell) {
    const value = cell.value;
    if (value && typeof value === 'object') {
        if (Object.prototype.hasOwnProperty.call(value, 'result')) return value.result;
        if (Array.isArray(value.richText)) return value.richText.map((item) => item.text).join('');
        if (typeof value.text === 'string') return value.text;
    }
    return value;
}

function numericValue(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && /^\s*-?\d+(?:\.\d+)?\s*$/.test(value)) {
        return Number(value);
    }
    return null;
}

function round(value, places) {
    const factor = 10 ** places;
    return Math.round((value + Number.EPSILON) * factor) / factor;
}

function compareMetric(current, baseline) {
    const difference = round(baseline - current, 2);
    return {
        maeChange: difference,
        status: difference > 0 ? 'improved' : difference < 0 ? 'worsened' : 'unchanged',
    };
}

async function main() {
    if (!fs.existsSync(DATASET_PATH)) {
        throw new Error('Validation dataset was not found at the expected repository path.');
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(DATASET_PATH);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
        throw new Error('Validation workbook has no worksheets.');
    }

    const headerRow = worksheet.getRow(3);
    const headerIndexes = new Map();
    headerRow.eachCell((cell, columnNumber) => {
        const header = String(cellValue(cell) ?? '').trim();
        if (header) headerIndexes.set(header, columnNumber);
    });

    const textColumn = headerIndexes.get('Letter_Text');
    const totalColumn = headerIndexes.get('Body_Score');
    const categoryColumns = CATEGORY_NAMES.map((name) => headerIndexes.get(name));
    if (!textColumn || !totalColumn || categoryColumns.some((column) => !column)) {
        throw new Error('Workbook is missing a required header for the validation.');
    }

    const categoryMetrics = Object.fromEntries(CATEGORY_NAMES.map((name) => [name, {
        exactMatches: 0,
        absoluteError: 0,
        predictedSum: 0,
        humanSum: 0,
    }]));
    const overall = {
        exactMatches: 0,
        absoluteError: 0,
        predictedSum: 0,
        humanSum: 0,
    };
    let records = 0;

    for (let rowNumber = 4; rowNumber <= worksheet.rowCount; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        const text = cellValue(row.getCell(textColumn));
        if (typeof text !== 'string' || !text.trim()) continue;

        const humanScores = categoryColumns.map((column) => numericValue(cellValue(row.getCell(column))));
        const humanTotal = numericValue(cellValue(row.getCell(totalColumn)));
        if (humanScores.some((score) => score === null) || humanTotal === null) {
            throw new Error('A letter record has missing or non-numeric human scores.');
        }

        const result = scoreLetterBodyExperimental(text);
        const predictedScores = CATEGORY_NAMES.map((name) => result.categories[name].score);
        const predictedTotal = predictedScores.reduce((sum, score) => sum + score, 0);
        records++;

        CATEGORY_NAMES.forEach((name, index) => {
            const metrics = categoryMetrics[name];
            const predicted = predictedScores[index];
            const human = humanScores[index];
            if (predicted === human) metrics.exactMatches++;
            metrics.absoluteError += Math.abs(predicted - human);
            metrics.predictedSum += predicted;
            metrics.humanSum += human;
        });

        if (predictedTotal === humanTotal) overall.exactMatches++;
        overall.absoluteError += Math.abs(predictedTotal - humanTotal);
        overall.predictedSum += predictedTotal;
        overall.humanSum += humanTotal;
    }

    if (records !== EXPECTED_RECORDS) {
        throw new Error(`Expected ${EXPECTED_RECORDS} valid records; found ${records}.`);
    }

    const categories = Object.fromEntries(CATEGORY_NAMES.map((name) => {
        const metrics = categoryMetrics[name];
        const current = {
            exactMatchPct: round((metrics.exactMatches / records) * 100, 1),
            mae: round(metrics.absoluteError / records, 2),
            predictedAverage: round(metrics.predictedSum / records, 2),
            humanAverage: round(metrics.humanSum / records, 2),
        };
        return [name, {
            experimental: current,
            baseline: BASELINE.categories[name],
            comparison: {
                ...compareMetric(current.mae, BASELINE.categories[name].mae),
                exactMatchChangePercentagePoints: round(
                    current.exactMatchPct - BASELINE.categories[name].exactMatchPct,
                    1,
                ),
            },
        }];
    }));

    const experimentalOverall = {
        exactMatchPct: round((overall.exactMatches / records) * 100, 1),
        mae: round(overall.absoluteError / records, 2),
        predictedAverage: round(overall.predictedSum / records, 2),
        humanAverage: round(overall.humanSum / records, 2),
    };

    const report = {
        evaluation: 'experimental rubric-band scorer; not production integrated',
        records,
        scoreRangePerCategory: '0-15',
        totalScoreRange: '0-75',
        categories,
        overall: {
            experimental: experimentalOverall,
            baseline: BASELINE.overall,
            comparison: {
                ...compareMetric(experimentalOverall.mae, BASELINE.overall.mae),
                exactMatchChangePercentagePoints: round(
                    experimentalOverall.exactMatchPct - BASELINE.overall.exactMatchPct,
                    1,
                ),
            },
        },
        privacy: 'Aggregate metrics only; no letter text or personal information included.',
    };

    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
    console.error(`Experimental scoring validation failed: ${error.message}`);
    process.exitCode = 1;
});
