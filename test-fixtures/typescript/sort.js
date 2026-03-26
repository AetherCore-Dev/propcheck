"use strict";
/**
 * Sort utilities — should pass all property tests.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.bubbleSort = bubbleSort;
exports.unique = unique;
exports.reverseArray = reverseArray;
function bubbleSort(arr) {
    const result = [...arr];
    for (let i = 0; i < result.length; i++) {
        for (let j = 0; j < result.length - i - 1; j++) {
            if (result[j] > result[j + 1]) {
                [result[j], result[j + 1]] = [result[j + 1], result[j]];
            }
        }
    }
    return result;
}
function unique(arr) {
    return [...new Set(arr)];
}
function reverseArray(arr) {
    return [...arr].reverse();
}
