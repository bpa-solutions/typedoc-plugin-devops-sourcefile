"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevopsSourcefileMapPlugin = void 0;
const fs = require("fs");
const path = require("path");
const components_1 = require("typedoc/dist/lib/converter/components");
const converter_1 = require("typedoc/dist/lib/converter/converter");
const component_1 = require("typedoc/dist/lib/utils/component");
let DevopsSourcefileMapPlugin = class DevopsSourcefileMapPlugin extends components_1.ConverterComponent {
    initialize() {
        this.listenTo(this.owner, converter_1.Converter.EVENT_BEGIN, this.onBegin);
    }
    onBegin() {
        // read options parameters
        const mapRelativePath = this.readStringOption("sourcefile-url-map");
        const urlPrefix = this.readStringOption("sourcefile-url-prefix");
        if (!mapRelativePath && !urlPrefix) {
            return;
        }
        try {
            if (mapRelativePath && urlPrefix) {
                throw new Error("use either --devops-sourcefile-url-prefix or --devops-sourcefile-url-map option");
            }
            if (mapRelativePath) {
                this.readMappingJson(mapRelativePath);
            }
            else if (urlPrefix) {
                this.mappings = [{
                        pattern: new RegExp("^"),
                        replace: urlPrefix,
                        version: undefined,
                    }];
            }
            // register handler
            this.listenTo(this.owner, converter_1.Converter.EVENT_RESOLVE_END, this.onEndResolve);
        }
        catch (e) {
            console.error("typedoc-plugin-sourcefile-url: " + e.message);
        }
    }
    readStringOption(name) {
        const options = this.application.options;
        const value = options.getValue(name);
        if (typeof value !== "string") {
            return undefined;
        }
        return value;
    }
    readMappingJson(mapRelativePath) {
        // load json
        const mapAbsolutePath = path.join(process.cwd(), mapRelativePath);
        let json;
        try {
            json = JSON.parse(fs.readFileSync(mapAbsolutePath, "utf8"));
        }
        catch (e) {
            throw new Error("error reading --devops-sourcefile-url-map json file: " + e.message);
        }
        // validate json
        if (!(json instanceof Array)) {
            throw new Error("--devops-sourcefile-url-map json file has to have Array as root element");
        }
        this.mappings = [];
        // validate & process json
        for (const mappingJson of json) {
            if (mappingJson instanceof Object
                && mappingJson.hasOwnProperty("pattern") && typeof mappingJson.pattern === "string"
                && mappingJson.hasOwnProperty("replace") && typeof mappingJson.replace === "string") {
                let regExp = null;
                let version = undefined;
                try {
                    regExp = new RegExp(mappingJson.pattern);
                }
                catch (e) {
                    throw new Error("error reading --devops-sourcefile-url-map: " + e.message);
                }
                if (mappingJson.hasOwnProperty("version") && typeof mappingJson.version === "string") {
                    version = mappingJson.version.trim();
                    if (typeof version === "string" && version.length > 0) {
                        if (version.indexOf("GB") !== 0 && version.indexOf("GT") !== 0) {
                            throw new Error("error reading --devops-sourcefile-url-map: The version value must start either with 'GB' (Git branch) or 'GT' (Git tag).");
                        }
                    }
                    else {
                        version = undefined;
                    }
                }
                this.mappings.push({
                    pattern: regExp,
                    replace: mappingJson.replace,
                    version: version
                });
            }
            else {
                throw new Error("--devops-sourcefile-url-map json file syntax has to be: [{\"pattern\": \"REGEX PATTERN STRING WITHOUT ENCLOSING SLASHES\", replace: \"STRING\", version?: \"STRING\"}, ETC.]");
            }
        }
    }
    onEndResolve(context) {
        if (this.mappings === undefined) {
            throw new Error("assertion fail");
        }
        const project = context.project;
        // process mappings
        for (const sourceFile of project.files) {
            for (const mapping of this.mappings) {
                if (sourceFile.fileName.match(mapping.pattern)) {
                    sourceFile.url = sourceFile.fileName.replace(mapping.pattern, mapping.replace);
                    if (typeof mapping.version === "string") {
                        sourceFile.url += "&version=" + encodeURIComponent(mapping.version);
                    }
                    break;
                }
            }
        }
        // add line anchors
        for (const key in project.reflections) {
            const reflection = project.reflections[key];
            if (reflection.sources) {
                reflection.sources.forEach((source) => {
                    if (source.file && source.file.url) {
                        source.url = source.file.url + "&line=" + source.line;
                    }
                });
            }
        }
    }
};
DevopsSourcefileMapPlugin = __decorate([
    component_1.Component({ name: "devops-sourcefile" })
], DevopsSourcefileMapPlugin);
exports.DevopsSourcefileMapPlugin = DevopsSourcefileMapPlugin;
