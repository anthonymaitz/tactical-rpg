"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var config_1 = require("vitest/config");
exports.default = (0, config_1.defineWorkspace)([
    'packages/*/vitest.config.ts',
    'apps/*/vitest.config.ts',
    'server/vitest.config.ts',
]);
