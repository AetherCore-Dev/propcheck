"use strict";
/**
 * String utilities — edge case heavy.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.capitalize = capitalize;
exports.truncate = truncate;
exports.repeat = repeat;
exports.isPalindrome = isPalindrome;
function capitalize(str) {
    if (str.length === 0)
        return str;
    return str[0].toUpperCase() + str.slice(1);
}
function truncate(str, maxLen) {
    if (str.length <= maxLen)
        return str;
    return str.slice(0, maxLen - 3) + "...";
}
function repeat(str, count) {
    return str.repeat(count);
}
function isPalindrome(str) {
    const cleaned = str.toLowerCase().replace(/[^a-z0-9]/g, "");
    return cleaned === cleaned.split("").reverse().join("");
}
