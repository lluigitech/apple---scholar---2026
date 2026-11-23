const fs = require('node:fs');
const path = require('node:path');
const ExcelJS = require('exceljs');
const { scoreLetterBody } = require('../services/letterBodyScoring');
const { scoreLetterBodyExperimental } = require('../services/experimentalLetterBodyScoring');
const {
    CATEGORY_NAMES,
    scoreLetterBodyExperimentalV3,
} = require('../services/experimentalLetterBodyScoringV3');

const EXPECTED_RECORDS = 162;
const DATASET_PATH = path.resolve(__dirname, '../../Real_Letters_Body_Scores_75pts_Combined current.xlsx');
const REPORT_PATH = path.resolve(__dirname, '../reports/experimental-letter-body-scoring-v3-validation.json');
const HUMAN_BANDS = [
    { label: '0', min: 0, max: 0 },
    { label: '1-3', min: 1, max: 3 },
    { label: '4-8', min: 4, max: 8 },
    { label: '9-12', min: 9, max: 12 },
    { label: '13-15', min: 13, max: 15 },
];
const VERSIONS = ['Baseline', 'V2', 'V3'];

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

function round(value, places = 2) {
    const factor = 10 ** places;
    return Math.round((value + Number.EPSILON) * factor) / factor;
}

function percent(numerator, denominator) {
    return denominator ? round((numerator / denominator) * 100, 1) : null;
}

function summarize(records, keys) {
    const count = records.length;
    const result = {
        records: count,
        meanPredicted: round(records.reduce((sum, record) => sum + record.predicted, 0) / count),
        meanReference: round(records.reduce((sum, record) => sum + record.reference, 0) / count),
        meanSignedError: round(
            records.reduce((sum, record) => sum + record.predicted - record.reference, 0) / count,
        ),
        mae: round(
            records.reduce((sum, record) => sum + Math.abs(record.predicted - record.reference), 0) / count,
        ),
        exactMatchPct: percent(
            records.filter((record) => record.predicted === record.reference).length,
            count,
        ),
    };

    if (keys) result.scoreCounts = keys.reduce((counts, score) => {
        counts[score] = records.filter((record) => record.predicted === score).length;
        return counts;
    }, {});

    return result;
}

function scoreRows(rows) {
    const scores = {
        Baseline: scoreLetterBody(rows.text),
        V2: scoreLetterBodyExperimental(rows.text),
        V3: scoreLetterBodyExperimentalV3(rows.text),
    };
    return Object.fromEntries(VERSIONS.map((version) => {
        const categoryScores = scores[version].categories;
        const categories = Object.fromEntries(CATEGORY_NAMES.map((name) => {
            const value = categoryScores[name];
            return [name, typeof value === 'number' ? value : value.score];
        }));
        return [version, {
            categories,
            total: CATEGORY_NAMES.reduce((sum, name) => sum + categories[name], 0),
        }];
    }));
}

function buildMetrics(records, scoreKeys) {
    const versionMetrics = {};
    for (const version of VERSIONS) {
        const categoryMetrics = {};
        for (const category of CATEGORY_NAMES) {
            const categoryRecords = records.map((record) => ({
                predicted: record.predictions[version].categories[category],
                reference: record.references[category],
            }));
            categoryMetrics[category] = summarize(categoryRecords, scoreKeys);
        }

        const overallRecords = records.map((record) => ({
            predicted: record.predictions[version].total,
            reference: record.referenceTotal,
        }));
        const overall = summarize(overallRecords);
        overall.maxScore = 75;

        const bandCalibration = Object.fromEntries(CATEGORY_NAMES.map((category) => [
            category,
            HUMAN_BANDS.map((band) => {
                const bandRecords = records
                    .filter((record) => record.references[category] >= band.min
                        && record.references[category] <= band.max)
                    .map((record) => ({
                        predicted: record.predictions[version].categories[category],
                        reference: record.references[category],
                    }));
                return {
                    humanBand: band.label,
                    records: bandRecords.length,
                    meanPredicted: bandRecords.length
                        ? round(bandRecords.reduce((sum, item) => sum + item.predicted, 0) / bandRecords.length)
                        : null,
                    meanSignedError: bandRecords.length
                        ? round(bandRecords.reduce(
                            (sum, item) => sum + item.predicted - item.reference,
                            0,
                        ) / bandRecords.length)
                        : null,
                    predictedWithinSameBandPct: bandRecords.length
                        ? percent(
                            bandRecords.filter((item) => item.predicted >= band.min
                                && item.predicted <= band.max).length,
                            bandRecords.length,
                        )
                        : null,
                };
            }),
        ]));

        versionMetrics[version] = {
            categories: categoryMetrics,
            overall,
            categoryBandCalibration: bandCalibration,
        };
    }

    const comparisons = Object.fromEntries(CATEGORY_NAMES.map((category) => {
        const baseline = versionMetrics.Baseline.categories[category];
        return [category, Object.fromEntries(['V2', 'V3'].map((version) => {
            const current = versionMetrics[version].categories[category];
            return [version, {
                maeChangeVsBaseline: round(baseline.mae - current.mae),
                signedErrorChangeVsBaseline: round(current.meanSignedError - baseline.meanSignedError),
                exactMatchChangePercentagePoints: round(
                    current.exactMatchPct - baseline.exactMatchPct,
                    1,
                ),
            }];
        }))];
    }));
    comparisons.Overall = Object.fromEntries(['V2', 'V3'].map((version) => {
        const baseline = versionMetrics.Baseline.overall;
        const current = versionMetrics[version].overall;
        return [version, {
            maeChangeVsBaseline: round(baseline.mae - current.mae),
            signedErrorChangeVsBaseline: round(current.meanSignedError - baseline.meanSignedError),
            exactMatchChangePercentagePoints: round(
                current.exactMatchPct - baseline.exactMatchPct,
                1,
            ),
        }];
    }));

    return { versions: versionMetrics, comparisons };
}

async function main() {
    if (!fs.existsSync(DATASET_PATH)) {
        throw new Error('Validation dataset was not found at the expected repository path.');
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(DATASET_PATH);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new Error('Validation workbook has no worksheets.');

    const headers = new Map();
    worksheet.getRow(3).eachCell((cell, columnNumber) => {
        const header = String(cellValue(cell) ?? '').trim();
        if (header) headers.set(header, columnNumber);
    });
    const textColumn = headers.get('Letter_Text');
    const totalColumn = headers.get('Body_Score');
    const categoryColumns = Object.fromEntries(
        CATEGORY_NAMES.map((name) => [name, headers.get(name)]),
    );
    if (!textColumn || !totalColumn || Object.values(categoryColumns).some((column) => !column)) {
        throw new Error('Validation workbook is missing a required header.');
    }

    const records = [];
    for (let rowNumber = 4; rowNumber <= worksheet.rowCount; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        const text = cellValue(row.getCell(textColumn));
        if (typeof text !== 'string' || !text.trim()) continue;

        const references = Object.fromEntries(CATEGORY_NAMES.map((category) => [
            category,
            numericValue(cellValue(row.getCell(categoryColumns[category]))),
        ]));
        const referenceTotal = numericValue(cellValue(row.getCell(totalColumn)));
        if (Object.values(references).some((score) => score === null) || referenceTotal === null) {
            throw new Error('A dataset record has missing or non-numeric reference scores.');
        }

        const rowData = { text, references, referenceTotal };
        rowData.predictions = scoreRows(rowData);
        records.push(rowData);
    }

    if (records.length !== EXPECTED_RECORDS) {
        throw new Error(`Expected ${EXPECTED_RECORDS} scored records; found ${records.length}.`);
    }

    const scoreKeys = Array.from({ length: 16 }, (_, index) => index);
    const metrics = buildMetrics(records, scoreKeys);
    const report = {
        evaluation: 'agreement with dataset reference scores; experimental only',
        referenceScores: 'AI-generated; not independently verified as human scores',
        records: records.length,
        scoreRange: { perCategory: '0-15', total: '0-75' },
        metrics: metrics.versions,
        comparisonsToBaseline: metrics.comparisons,
        privacy: 'Aggregate metrics only; no letter text, names, IDs, or personal information included.',
    };

    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
    console.error(`V3 validation failed: ${error.message}`);
    process.exitCode = 1;
});
